<?php
/**
 * Plugin Name: Wild Maps
 * Description: Elementor widget with MapLibre + MapTiler for Wild Maps.
 * Version: 1.1.0-dev-ipcenter-fix
 * Author: Stay Wild
 * Text Domain: wild-maps
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'SWM_VERSION', '1.1.0-dev-ipcenter-fix' );
define( 'SWM_PATH', plugin_dir_path( __FILE__ ) );
define( 'SWM_URL', plugin_dir_url( __FILE__ ) );

require_once SWM_PATH . 'includes/class-swm-plugin.php';

add_action( 'plugins_loaded', function () {
	\WildMaps\Plugin::instance();
} );
