<?php
namespace Annoudio;

use Closure;
use Laminas\Http\Client;

/**
 * The Annoudio stack as this Omeka S knows it: the origin, the project, and the checks.
 *
 * This class is the only place that knows the stack's public routes.
 */
class Stack
{
    const SETTING_ORIGIN = 'annoudio_origin';
    const SETTING_PROJECT = 'annoudio_project';
    const SETTING_SERVER_ORIGIN = 'annoudio_server_origin';

    /** Cache time of a recording on page views: the stack's own max-age (CONTRACT.md 5.1). */
    const CACHE_SECONDS = 300;

    /** Cache time of a failed read: the stack's 404 max-age (CONTRACT.md 5.1). */
    const FAILURE_SECONDS = 60;

    /**
     * @param string $origin The origin that visitors' browsers use.
     * @param string $project The project slug.
     * @param string $serverOrigin The origin that this server uses for checks. Empty: the same as $origin.
     * @param Closure(): Client $client Gives a new HTTP client.
     * @param FileCache $cache The cache of recordings for page views.
     */
    public function __construct(
        public readonly string $origin,
        public readonly string $project,
        public readonly string $serverOrigin,
        private readonly Closure $client,
        private readonly FileCache $cache,
    ) {
    }

    /**
     * Accepts an origin: scheme http or https, a host, an optional port, no path.
     * One trailing "/" is accepted and removed.
     *
     * @throws StackError When the value is not an origin.
     */
    public static function normalizeOrigin(string $value): string
    {
        $value = trim($value);
        $parts = parse_url($value);
        $path = is_array($parts) ? ($parts['path'] ?? '') : '';
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])
            || !in_array(strtolower($parts['scheme']), ['http', 'https'], true)
            || ($path !== '' && $path !== '/')
            || isset($parts['query']) || isset($parts['fragment']) || isset($parts['user'])
        ) {
            throw new StackError(StackError::BAD_ORIGIN, sprintf(
                '"%s" is not a stack address. Type only the start of the address, for example https://stories.example.org.', // @translate
                $value
            ));
        }
        $port = isset($parts['port']) ? ':' . (int) $parts['port'] : '';
        return strtolower($parts['scheme']) . '://' . strtolower($parts['host']) . $port;
    }

    public function isConfigured(): bool
    {
        return $this->origin !== '' && $this->project !== '';
    }

    /** The loader of the snippet (CONTRACT.md 1). */
    public function loaderUrl(): string
    {
        return $this->origin . '/embed/v1.js';
    }

    /**
     * Checks the pair (origin, project): the stack serves the project's theme JSON
     * (CONTRACT.md 3.2).
     *
     * @return string The project name ("River Voices"), or "" when the stack is older
     *     than the project frame (CONTRACT.md 3.2, rule 7).
     * @throws StackError
     */
    public function checkProject(): string
    {
        [$code, $body] = $this->get('/embed/v1/themes/' . rawurlencode($this->project) . '.json');
        if ($code === 404) {
            throw new StackError(StackError::NOT_FOUND, sprintf(
                'The stack has no project "%s". Copy the project slug from the Annoudio admin, page Projects.', // @translate
                $this->project
            ));
        }
        if ($code !== 200) {
            throw $this->unexpected($code);
        }
        $json = json_decode($body, true);
        return is_array($json) && isset($json['name']) && is_string($json['name']) ? trim($json['name']) : '';
    }

    /**
     * Reads one recording of the catalogue (CONTRACT.md 5.2). One request, no cache.
     *
     * @param string $recording The recording number from the Annoudio admin ("Recording number: 1").
     * @return array{id:string, title:string, url:string}
     * @throws StackError
     */
    public function recording(string $recording): array
    {
        $recording = trim($recording);
        if (!ctype_digit($recording)) {
            throw new StackError(StackError::BAD_RECORDING, sprintf(
                '"%s" is not a recording number. Type a number, for example 1. The Snippet panel of the Annoudio admin shows it: "Recording number: 1".', // @translate
                $recording
            ));
        }
        return $this->readRecording($recording, 5);
    }

    /**
     * The recording for a page view: from a cache of CACHE_SECONDS, else one request with a
     * short timeout. A failure is cached for FAILURE_SECONDS, so a stack that is down slows
     * one page view per minute, not every view. Never throws: null means "use the stored value".
     *
     * @return array{id:string, title:string, url:string}|null
     */
    public function cachedRecording(string $recording): ?array
    {
        $recording = trim($recording);
        if (!$this->isConfigured() || !ctype_digit($recording)) {
            return null;
        }
        // The key holds every value that the answer depends on: a changed setting is a miss.
        $key = 'recording|' . $this->base() . '|' . $this->project . '|' . $recording;
        $cached = $this->cache->get($key);
        if (is_array($cached)) {
            return is_array($cached['recording'] ?? null) ? $cached['recording'] : null;
        }
        try {
            $found = $this->readRecording($recording, 2);
        } catch (StackError) {
            $found = null;
        }
        $this->cache->set($key, ['recording' => $found], $found === null ? self::FAILURE_SECONDS : self::CACHE_SECONDS);
        return $found;
    }

    /**
     * GET /embed/v1/recordings/{project}/{id}.json and checks the shape.
     *
     * @return array{id:string, title:string, url:string}
     * @throws StackError
     */
    private function readRecording(string $recording, int $timeout): array
    {
        [$code, $body] = $this->get('/embed/v1/recordings/' . rawurlencode($this->project) . '/' . $recording . '.json', $timeout);
        if ($code === 404) {
            throw new StackError(StackError::NOT_FOUND, sprintf(
                'The project "%2$s" has no recording with the number "%1$s". Copy the number after "Recording number:" in the Snippet panel of the Annoudio admin.', // @translate
                $recording,
                $this->project
            ));
        }
        if ($code !== 200) {
            throw $this->unexpected($code);
        }
        $json = json_decode($body, true);
        $url = is_array($json) && isset($json['url']) && is_string($json['url']) ? $json['url'] : '';
        $title = is_array($json) && isset($json['title']) && is_string($json['title']) ? trim($json['title']) : '';
        if (!preg_match('~^https?://\S+$~i', $url)) {
            throw new StackError(StackError::UNEXPECTED, 'The stack sent a recording without an audio address. Ask the Annoudio operator to check the recording.'); // @translate
        }
        return ['id' => $recording, 'title' => $title !== '' ? $title : $recording, 'url' => $url];
    }

    /**
     * One GET request to the stack, from this server.
     *
     * @return array{0:int, 1:string} Status and body.
     * @throws StackError
     */
    private function get(string $path, int $timeout = 5): array
    {
        if (!$this->isConfigured()) {
            throw new StackError(StackError::NOT_CONFIGURED, 'Annoudio is not set up. A global administrator must type the stack address and the project in Modules, Annoudio, Configure.'); // @translate
        }
        $url = $this->base() . $path;
        /** @var Client $client */
        $client = ($this->client)();
        $client->setUri($url);
        $client->setOptions(['timeout' => $timeout, 'maxredirects' => 0]);
        $client->setHeaders(['Accept' => 'application/json, application/ld+json']);
        try {
            $response = $client->send();
        } catch (\Throwable $e) {
            throw new StackError(StackError::UNREACHABLE, sprintf(
                'This server cannot reach %1$s (%2$s). Check the stack address. If Omeka S runs in Docker or behind a firewall, set the server address.', // @translate
                $url,
                $e->getMessage()
            ));
        }
        return [$response->getStatusCode(), $response->getBody()];
    }

    /** The origin that this server uses: the server address, else the stack address. */
    private function base(): string
    {
        return $this->serverOrigin !== '' ? $this->serverOrigin : $this->origin;
    }

    private function unexpected(int $code): StackError
    {
        return new StackError(StackError::UNEXPECTED, sprintf(
            'The stack answered with HTTP status %d. Try again later, or ask the Annoudio operator.', // @translate
            $code
        ));
    }
}
