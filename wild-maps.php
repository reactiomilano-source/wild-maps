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

require_once SWM_PATH . 'includes/class-swm-plugin.php';
require_once SWM_PATH . 'includes/class-swm-wmap-compat.php';

add_action( 'plugins_loaded', function () {
	\WildMaps\Plugin::instance();
} );

add_action( 'plugins_loaded', function () {
	\WildMaps\Wmap_Compat::instance();
}, 20 );
