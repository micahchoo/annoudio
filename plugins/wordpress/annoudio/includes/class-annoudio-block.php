<?php
/**
 * The "Annoudio player" block: a dynamic block that prints the snippet of CONTRACT.md 1.
 *
 * The post stores only two attributes (recording, src) in the block comment, never HTML.
 * So the block works for authors without the unfiltered_html capability.
 *
 * `src` comes from the Annoudio admin at render time (CONTRACT.md 5.2, cached for
 * Annoudio_Stack::CACHE_SECONDS). The stored `src` is only the fallback for a stack that
 * this server cannot reach.
 *
 * @package Annoudio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers the block, its server render and the editor's check route.
 */
final class Annoudio_Block {

	public const NAME = 'annoudio/player';

	/** The script handle of the loader. One handle, so WordPress prints it once per page. */
	public const LOADER_HANDLE = 'annoudio-loader';

	/** Adds the hooks. */
	public static function init(): void {
		add_action( 'init', array( self::class, 'register' ) );
		add_action( 'rest_api_init', array( self::class, 'register_route' ) );
		add_action( 'enqueue_block_editor_assets', array( self::class, 'editor_config' ) );
	}

	/** Registers the block from block.json, with the server render. */
	public static function register(): void {
		register_block_type(
			ANNOUDIO_DIR . 'block',
			array( 'render_callback' => array( self::class, 'render' ) )
		);
	}

	/**
	 * Prints the snippet. The audio address is the admin's (a cached read of the recording
	 * route); the stored one is the fallback when the stack does not answer.
	 *
	 * @param array<string,mixed> $attributes The block attributes.
	 * @return string The HTML, or "" when the block or the site is not set up.
	 */
	public static function render( $attributes ): string {
		$stack     = Annoudio_Stack::from_options();
		$recording = trim( (string) ( $attributes['recording'] ?? '' ) );
		if ( ! $stack->is_configured() || '' === $recording ) {
			return '';
		}
		$found = $stack->cached_recording( $recording );
		$src   = null !== $found ? $found['url'] : trim( (string) ( $attributes['src'] ?? '' ) );
		$src   = esc_url( $src, array( 'http', 'https' ) );
		if ( '' === $src ) {
			return '';
		}
		// Version null: no "?ver=" on the URL. The loader URL is part of the contract
		// (CONTRACT.md 1), and the stack sets its cache rules (CONTRACT.md 5.1).
		// phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
		wp_enqueue_script( self::LOADER_HANDLE, $stack->loader_url(), array(), null, array( 'strategy' => 'async' ) );
		return sprintf(
			'<div %1$s><annoudio-player project="%2$s" recording="%3$s" src="%4$s"></annoudio-player></div>',
			get_block_wrapper_attributes(),
			esc_attr( $stack->project ),
			esc_attr( $recording ),
			$src
		);
	}

	/** GET /wp-json/annoudio/v1/recordings/{id}: the editor reads a recording (title, audio address). */
	public static function register_route(): void {
		register_rest_route(
			'annoudio/v1',
			'/recordings/(?P<id>[^/]+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( self::class, 'check_recording' ),
				'permission_callback' => static fn () => current_user_can( 'edit_posts' ),
				'args'                => array(
					'id' => array(
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);
	}

	/**
	 * @param WP_REST_Request $request The request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function check_recording( WP_REST_Request $request ) {
		$found = Annoudio_Stack::from_options()->recording( (string) $request['id'] );
		if ( is_wp_error( $found ) ) {
			$status = array(
				'annoudio_no_recording'   => 404,
				'annoudio_bad_recording'  => 400,
				'annoudio_not_configured' => 409,
			)[ $found->get_error_code() ] ?? 502;
			$found->add_data( array( 'status' => $status ) );
			return $found;
		}
		return rest_ensure_response( $found );
	}

	/** Gives the editor script the project and the settings link. */
	public static function editor_config(): void {
		$stack  = Annoudio_Stack::from_options();
		$config = array(
			'project'     => $stack->project,
			'configured'  => $stack->is_configured(),
			'settingsUrl' => current_user_can( 'manage_options' ) ? admin_url( 'options-general.php?page=annoudio' ) : '',
		);
		wp_add_inline_script(
			generate_block_asset_handle( self::NAME, 'editorScript' ),
			'window.annoudioConfig = ' . wp_json_encode( $config ) . ';',
			'before'
		);
	}
}
