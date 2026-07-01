<?php
/**
 * Plugin Name: Wild Maps
 * Description: Elementor widget with MapLibre + MapTiler for Wild Maps.
 * Version: 1.3.0-dev
 * Author: Stay Wild
 * Text Domain: wild-maps
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'SWM_VERSION', '1.3.0-dev' );
define( 'SWM_PATH', plugin_dir_path( __FILE__ ) );
define( 'SWM_URL', plugin_dir_url( __FILE__ ) );
define( 'SWM_WMAP_FORMAT_VERSION', '1.3' );

require_once SWM_PATH . 'includes/class-swm-loader.php';

\WildMaps\Loader::require_files( [
	'includes/class-swm-plugin.php',
	'includes/class-swm-wmap-compat.php',
] );

add_action( 'admin_enqueue_scripts', function( $hook ) {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	$is_swm_screen = false !== strpos( (string) $hook, 'wild-maps' ) || ( $screen && in_array( $screen->post_type, [ 'swm_map_point', 'swm_map_project' ], true ) );
	if ( ! $is_swm_screen ) { return; }
	wp_enqueue_script( 'swm-route-store', SWM_URL . 'assets/js/route-editor/route-store.js', [], SWM_VERSION, true );
	wp_enqueue_script( 'swm-route-store-bridge', SWM_URL . 'assets/js/route-editor/route-store-bridge.js', [ 'swm-route-store' ], SWM_VERSION, true );
	wp_enqueue_script( 'swm-version-badge', SWM_URL . 'assets/js/admin-version-badge.js', [], SWM_VERSION, true );
}, 9 );

add_action( 'admin_enqueue_scripts', function( $hook ) {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	$is_swm_screen = false !== strpos( (string) $hook, 'wild-maps' ) || ( $screen && in_array( $screen->post_type, [ 'swm_map_point', 'swm_map_project' ], true ) );
	if ( ! $is_swm_screen ) { return; }
	wp_enqueue_script( 'swm-route-actions', SWM_URL . 'assets/js/route-editor/route-actions.js', [ 'swm-admin', 'swm-route-store', 'swm-route-store-bridge' ], SWM_VERSION, true );
}, 11 );

add_action( 'plugins_loaded', function () {
	\WildMaps\Plugin::instance();
} );

add_action( 'plugins_loaded', function () {
	\WildMaps\Wmap_Compat::instance();
}, 20 );
