<?php
/**
 * Runs when an administrator deletes the plugin: removes the one setting.
 *
 * @package Annoudio
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'annoudio' );
