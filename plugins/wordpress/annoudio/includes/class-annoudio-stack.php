<?php
/**
 * The Annoudio stack as this site knows it: the origin, the project, and the checks.
 *
 * This class is the only place that knows the stack's public routes. The block, the
 * settings page and the REST route use it and nothing else.
 *
 * @package Annoudio
 */

defined( 'ABSPATH' ) || exit;

/**
 * One configured stack and project.
 */
final class Annoudio_Stack {

	/** The option that holds the settings. */
	public const OPTION = 'annoudio';

	/** Cache time of a recording on page views: the stack's own max-age (CONTRACT.md 5.1). */
	public const CACHE_SECONDS = 300;

	/** Cache time of a failed read: the stack's 404 max-age (CONTRACT.md 5.1). */
	public const FAILURE_SECONDS = 60;

	/**
	 * Makes the stack from the saved settings.
	 */
	public static function from_options(): self {
		$o = get_option( self::OPTION, array() );
		$o = is_array( $o ) ? $o : array();
		return new self(
			(string) ( $o['origin'] ?? '' ),
			(string) ( $o['project'] ?? '' ),
			(string) ( $o['server_origin'] ?? '' )
		);
	}

	/**
	 * Accepts an origin: scheme http or https, a host, an optional port, no path.
	 * One trailing "/" is accepted and removed (CONTRACT.md 2.5, point 1 of phase 2 notes).
	 *
	 * @param string $value The text that the administrator typed.
	 * @return string|WP_Error The origin without a trailing "/", or an error.
	 */
	public static function normalize_origin( string $value ) {
		$value = trim( $value );
		$parts = wp_parse_url( $value );
		$bad   = new WP_Error(
			'annoudio_bad_origin',
			/* translators: %s: the address that the administrator typed. */
			sprintf( __( '"%s" is not a stack address. Type only the start of the address, for example https://stories.example.org.', 'annoudio' ), $value )
		);
		if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return $bad;
		}
		$scheme = strtolower( $parts['scheme'] );
		$path   = $parts['path'] ?? '';
		if ( ! in_array( $scheme, array( 'http', 'https' ), true ) || ( '' !== $path && '/' !== $path )
			|| isset( $parts['query'] ) || isset( $parts['fragment'] ) || isset( $parts['user'] ) ) {
			return $bad;
		}
		$port = isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '';
		return $scheme . '://' . strtolower( $parts['host'] ) . $port;
	}

	/**
	 * @param string $origin        The origin that visitors' browsers use.
	 * @param string $project       The project slug.
	 * @param string $server_origin The origin that this server uses for checks. Empty: the same as $origin.
	 */
	public function __construct(
		public readonly string $origin,
		public readonly string $project,
		public readonly string $server_origin = ''
	) {}

	/** True when the origin and the project are set. */
	public function is_configured(): bool {
		return '' !== $this->origin && '' !== $this->project;
	}

	/** The loader of the snippet (CONTRACT.md 1). */
	public function loader_url(): string {
		return $this->origin . '/embed/v1.js';
	}

	/**
	 * Checks the pair (origin, project): the stack serves the project's theme JSON
	 * (CONTRACT.md 3.2).
	 *
	 * @return string|WP_Error The project name ("River Voices"), or "" when the stack is
	 *                         older than the project frame (CONTRACT.md 3.2, rule 7).
	 */
	public function check_project() {
		$response = $this->get( '/embed/v1/themes/' . rawurlencode( $this->project ) . '.json' );
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		if ( 404 === $response['code'] ) {
			return new WP_Error(
				'annoudio_no_project',
				/* translators: %s: the project slug. */
				sprintf( __( 'The stack has no project "%s". Copy the project slug from the Annoudio admin, page Projects.', 'annoudio' ), $this->project )
			);
		}
		if ( 200 !== $response['code'] ) {
			return $this->unexpected( $response['code'] );
		}
		$body = json_decode( $response['body'], true );
		return is_array( $body ) && isset( $body['name'] ) && is_string( $body['name'] ) ? trim( $body['name'] ) : '';
	}

	/**
	 * Reads one recording of the catalogue (CONTRACT.md 5.2). One request, no cache.
	 *
	 * @param string $recording The recording number from the Annoudio admin ("Recording number: 1").
	 * @return array{id:string, title:string, url:string}|WP_Error
	 */
	public function recording( string $recording ) {
		$recording = trim( $recording );
		if ( '' === $recording ) {
			return new WP_Error( 'annoudio_no_recording', __( 'Type the recording number.', 'annoudio' ) );
		}
		if ( ! ctype_digit( $recording ) ) {
			return new WP_Error(
				'annoudio_bad_recording',
				/* translators: %s: the text that the editor typed. */
				sprintf( __( '"%s" is not a recording number. Type a number, for example 1. The Snippet panel of the Annoudio admin shows it: "Recording number: 1".', 'annoudio' ), $recording )
			);
		}
		return $this->read_recording( $recording, 5 );
	}

	/**
	 * The recording for a page view: from a cache of CACHE_SECONDS, else one request with a
	 * short timeout. A failure is cached for FAILURE_SECONDS, so a stack that is down slows
	 * one page view per minute, not every view. Never an error: null means "use the stored value".
	 *
	 * @param string $recording The recording number.
	 * @return array{id:string, title:string, url:string}|null
	 */
	public function cached_recording( string $recording ): ?array {
		$recording = trim( $recording );
		if ( ! $this->is_configured() || ! ctype_digit( $recording ) ) {
			return null;
		}
		// The key holds every value that the answer depends on: a changed setting is a miss.
		$key    = 'annoudio_rec_' . md5( $this->base() . '|' . $this->project . '|' . $recording );
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached['recording'] ?? null;
		}
		$found = $this->read_recording( $recording, 2 );
		$found = is_wp_error( $found ) ? null : $found;
		set_transient( $key, array( 'recording' => $found ), null === $found ? self::FAILURE_SECONDS : self::CACHE_SECONDS );
		return $found;
	}

	/**
	 * GET /embed/v1/recordings/{project}/{id}.json and checks the shape.
	 *
	 * @param string $recording A recording number (digits only).
	 * @param int    $timeout   Seconds.
	 * @return array{id:string, title:string, url:string}|WP_Error
	 */
	private function read_recording( string $recording, int $timeout ) {
		$response = $this->get( '/embed/v1/recordings/' . rawurlencode( $this->project ) . '/' . $recording . '.json', $timeout );
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		if ( 404 === $response['code'] ) {
			return new WP_Error(
				'annoudio_no_recording',
				/* translators: 1: recording id, 2: project slug. */
				sprintf( __( 'The project "%2$s" has no recording with the number "%1$s". Copy the number after "Recording number:" in the Snippet panel of the Annoudio admin.', 'annoudio' ), $recording, $this->project )
			);
		}
		if ( 200 !== $response['code'] ) {
			return $this->unexpected( $response['code'] );
		}
		$body  = json_decode( $response['body'], true );
		$url   = is_array( $body ) && isset( $body['url'] ) && is_string( $body['url'] ) ? $body['url'] : '';
		$title = is_array( $body ) && isset( $body['title'] ) && is_string( $body['title'] ) ? trim( $body['title'] ) : '';
		if ( ! preg_match( '~^https?://\S+$~i', $url ) ) {
			return new WP_Error( 'annoudio_unexpected', __( 'The stack sent a recording without an audio address. Ask the Annoudio operator to check the recording.', 'annoudio' ) );
		}
		return array(
			'id'    => $recording,
			'title' => '' !== $title ? $title : $recording,
			'url'   => $url,
		);
	}

	/**
	 * One GET request to the stack, from this server.
	 *
	 * The address is the administrator's setting, so wp_remote_get (not wp_safe_remote_get):
	 * a stack on a private network address is a valid setup.
	 *
	 * @param string $path    The path, starting with "/".
	 * @param int    $timeout Seconds.
	 * @return array{code:int, body:string}|WP_Error
	 */
	private function get( string $path, int $timeout = 5 ) {
		if ( ! $this->is_configured() ) {
			return new WP_Error( 'annoudio_not_configured', __( 'Annoudio is not set up. An administrator must type the stack address and the project in Settings, Annoudio.', 'annoudio' ) );
		}
		$url      = $this->base() . $path;
		$response = wp_remote_get(
			$url,
			array(
				'timeout'     => $timeout,
				'redirection' => 0,
				'headers'     => array( 'Accept' => 'application/json, application/ld+json' ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return new WP_Error(
				'annoudio_unreachable',
				/* translators: 1: address, 2: error message. */
				sprintf( __( 'This site cannot reach %1$s (%2$s). Check the stack address. If WordPress runs in Docker or behind a firewall, set the server address.', 'annoudio' ), $url, $response->get_error_message() )
			);
		}
		return array(
			'code' => (int) wp_remote_retrieve_response_code( $response ),
			'body' => (string) wp_remote_retrieve_body( $response ),
		);
	}

	/** The origin that this server uses: the server address, else the stack address. */
	private function base(): string {
		return '' !== $this->server_origin ? $this->server_origin : $this->origin;
	}

	/**
	 * @param int $code The HTTP status.
	 */
	private function unexpected( int $code ): WP_Error {
		/* translators: %d: HTTP status code. */
		return new WP_Error( 'annoudio_unexpected', sprintf( __( 'The stack answered with HTTP status %d. Try again later, or ask the Annoudio operator.', 'annoudio' ), $code ) );
	}
}
