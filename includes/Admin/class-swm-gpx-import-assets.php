<?php
namespace WildMaps\Admin;

if ( ! defined( 'ABSPATH' ) ) { exit; }

class GPX_Import_Assets {
	public static function init() {
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue' ], 12 );
	}

	public static function enqueue( $hook ) {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$is_swm_screen = false !== strpos( (string) $hook, 'wild-maps' ) || ( $screen && in_array( $screen->post_type, [ 'swm_map_point', 'swm_map_project' ], true ) );
		if ( ! $is_swm_screen ) { return; }
		wp_enqueue_script( 'swm-gpx-routes', SWM_URL . 'assets/js/route-editor/gpx-import.js', [ 'swm-admin', 'swm-route-store', 'swm-multi-route-ui' ], SWM_VERSION, true );
	}
}
