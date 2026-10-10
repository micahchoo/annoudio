<?php
/**
 * The settings page: Settings, Annoudio. One setting for the whole site.
 *
 * @package Annoudio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers the option and draws the page.
 */
final class Annoudio_Settings {

	private const PAGE  = 'annoudio';
	private const GROUP = 'annoudio';

	/** Adds the hooks. */
	public static function init(): void {
		add_action( 'admin_init', array( self::class, 'register' ) );
		add_action( 'admin_menu', array( self::class, 'menu' ) );
	}

	/** Registers the option with its sanitizer. */
	public static function register(): void {
		register_setting(
			self::GROUP,
			Annoudio_Stack::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( self::class, 'sanitize' ),
				'default'           => array(
					'origin'        => '',
					'project'       => '',
					'server_origin' => '',
				),
				'show_in_rest'      => false,
			)
		);
	}

	/** Adds Settings, Annoudio. */
	public static function menu(): void {
		add_options_page(
			__( 'Annoudio', 'annoudio' ),
			__( 'Annoudio', 'annoudio' ),
			'manage_options',
			self::PAGE,
			array( self::class, 'page' )
		);
	}

	/**
	 * Normalizes the input. A bad address keeps the old value and shows an error.
	 * The connection check is not done here: the page shows it each time it opens.
	 *
	 * @param mixed $input The posted value.
	 * @return array<string,string>
	 */
	public static function sanitize( $input ): array {
		$old   = get_option( Annoudio_Stack::OPTION, array() );
		$old   = is_array( $old ) ? $old : array();
		$input = is_array( $input ) ? $input : array();
		$out   = array(
			'origin'        => (string) ( $old['origin'] ?? '' ),
			'project'       => sanitize_text_field( (string) ( $input['project'] ?? '' ) ),
			'server_origin' => (string) ( $old['server_origin'] ?? '' ),
		);
		foreach ( array( 'origin', 'server_origin' ) as $key ) {
			$value = trim( (string) ( $input[ $key ] ?? '' ) );
			if ( '' === $value ) {
				$out[ $key ] = '';
				continue;
			}
			$origin = Annoudio_Stack::normalize_origin( $value );
			if ( is_wp_error( $origin ) ) {
				add_settings_error( Annoudio_Stack::OPTION, 'annoudio_' . $key, $origin->get_error_message() );
				continue;
			}
			$out[ $key ] = $origin;
		}
		return $out;
	}

	/** Draws the page. */
	public static function page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$stack = Annoudio_Stack::from_options();
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Annoudio', 'annoudio' ); ?></h1>
			<p><?php esc_html_e( 'Copy these values from the Annoudio admin. The "Annoudio widget" block uses them on every page of this site.', 'annoudio' ); ?></p>
			<?php self::status( $stack ); ?>
			<form action="options.php" method="post">
				<?php settings_fields( self::GROUP ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="annoudio-origin"><?php esc_html_e( 'Stack address', 'annoudio' ); ?></label></th>
						<td>
							<input type="url" class="regular-text code" id="annoudio-origin" name="annoudio[origin]" value="<?php echo esc_attr( $stack->origin ); ?>" placeholder="https://stories.example.org">
							<p class="description"><?php esc_html_e( 'The start of the address in the snippet, before /embed/v1.js. Visitors\' browsers use this address.', 'annoudio' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="annoudio-project"><?php esc_html_e( 'Project', 'annoudio' ); ?></label></th>
						<td>
							<input type="text" class="regular-text code" id="annoudio-project" name="annoudio[project]" value="<?php echo esc_attr( $stack->project ); ?>" placeholder="river-voices">
							<p class="description"><?php esc_html_e( 'The project slug: the value of project="…" in the snippet.', 'annoudio' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="annoudio-server-origin"><?php esc_html_e( 'Server address (optional)', 'annoudio' ); ?></label></th>
						<td>
							<input type="url" class="regular-text code" id="annoudio-server-origin" name="annoudio[server_origin]" value="<?php echo esc_attr( $stack->server_origin ); ?>">
							<p class="description"><?php esc_html_e( 'Leave this empty in most cases. Set it only when this server must use a different address to reach the stack, for example when both run in Docker on one computer. Only the checks on this page and in the block use it.', 'annoudio' ); ?></p>
						</td>
					</tr>
				</table>
				<?php submit_button( __( 'Save and check', 'annoudio' ) ); ?>
			</form>
		</div>
		<?php
	}

	/**
	 * Shows "Connected to River Voices (project river-voices) at …" or the problem.
	 *
	 * @param Annoudio_Stack $stack The saved settings.
	 */
	private static function status( Annoudio_Stack $stack ): void {
		if ( ! $stack->is_configured() ) {
			printf( '<div class="notice notice-warning inline" id="annoudio-status"><p>%s</p></div>', esc_html__( 'Not set up. Type the stack address and the project, then save.', 'annoudio' ) );
			return;
		}
		$name = $stack->check_project();
		if ( is_wp_error( $name ) ) {
			printf( '<div class="notice notice-error inline" id="annoudio-status"><p>%s</p></div>', esc_html( $name->get_error_message() ) );
			return;
		}
		$text = '' !== $name
			/* translators: 1: project name, 2: project slug, 3: stack address. */
			? sprintf( __( 'Connected to %1$s (project %2$s) at %3$s.', 'annoudio' ), $name, $stack->project, $stack->origin )
			/* translators: 1: project slug, 2: stack address. */
			: sprintf( __( 'Connected to project %1$s at %2$s.', 'annoudio' ), $stack->project, $stack->origin );
		printf( '<div class="notice notice-success inline" id="annoudio-status"><p>%s</p></div>', esc_html( $text ) );
	}
}
