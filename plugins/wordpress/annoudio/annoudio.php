<?php
/**
 * Plugin Name:       Annoudio
 * Description:       The "Annoudio widget" block. It shows a recording and its community stories from your Annoudio stack.
 * Version:           0.3.0
 * Requires at least: 6.5
 * Requires PHP:      8.2
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       annoudio
 *
 * @package Annoudio
 */

defined( 'ABSPATH' ) || exit;

define( 'ANNOUDIO_DIR', plugin_dir_path( __FILE__ ) );

require_once ANNOUDIO_DIR . 'includes/class-annoudio-stack.php';
require_once ANNOUDIO_DIR . 'includes/class-annoudio-settings.php';
require_once ANNOUDIO_DIR . 'includes/class-annoudio-block.php';

Annoudio_Settings::init();
Annoudio_Block::init();
