<?php
namespace Annoudio;

/**
 * A small cache of JSON values in files, with an expiry time. Omeka S has no cache
 * service for modules, and APCu is not always there. One file per key, in Omeka's
 * temp_dir. A broken or old file is a miss. Writes are atomic (rename).
 */
class FileCache
{
    public function __construct(private readonly string $dir)
    {
    }

    /** The module's cache: the folder "annoudio" in Omeka's temp_dir. */
    public static function fromConfig(array $config): self
    {
        return new self(rtrim((string) ($config['temp_dir'] ?? sys_get_temp_dir()), '/') . '/annoudio');
    }

    /** Removes every entry and the folder. */
    public function clear(): void
    {
        foreach (glob($this->dir . '/*.json') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($this->dir);
    }

    /** The value, or null for a miss. */
    public function get(string $key): mixed
    {
        $text = @file_get_contents($this->path($key));
        $entry = is_string($text) ? json_decode($text, true) : null;
        if (!is_array($entry) || !isset($entry['expires']) || $entry['expires'] < time()) {
            return null;
        }
        return $entry['value'] ?? null;
    }

    /** Keeps the value for $seconds. A failed write is not an error: the next read is a miss. */
    public function set(string $key, mixed $value, int $seconds): void
    {
        if (!is_dir($this->dir) && !@mkdir($this->dir, 0775, true) && !is_dir($this->dir)) {
            return;
        }
        $tmp = @tempnam($this->dir, 'tmp');
        if ($tmp === false) {
            return;
        }
        if (@file_put_contents($tmp, json_encode(['expires' => time() + $seconds, 'value' => $value])) === false
            || !@rename($tmp, $this->path($key))
        ) {
            @unlink($tmp);
        }
    }

    private function path(string $key): string
    {
        return $this->dir . '/' . hash('sha256', $key) . '.json';
    }
}
