<?php
namespace WildMaps\Core;

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Route_Collection_Ajax {
	public static function init() {
		add_action( 'wp_' . 'ajax_swm_admin_get_routes', [ __CLASS__, 'get_routes' ] );
		add_action( 'wp_' . 'ajax_swm_admin_save_routes', [ __CLASS__, 'save_routes' ] );
	}

	private static function project_id() {
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( [ 'message' => 'Permessi insufficienti.' ], 403 );
		}
		$nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
		if ( ! wp_verify_nonce( $nonce, 'swm_admin' ) ) {
			wp_send_json_error( [ 'message' => 'Nonce non valido.' ], 403 );
		}
		$project_id = isset( $_POST['project_id'] ) ? absint( $_POST['project_id'] ) : 0;
		if ( ! $project_id || 'swm_map_project' !== get_post_type( $project_id ) ) {
			wp_send_json_error( [ 'message' => 'Progetto non valido.' ], 400 );
		}
		return $project_id;
	}

	public static function get_routes() {
		$project_id = self::project_id();
		wp_send_json_success( Route_Collection::payload( $project_id ) );
	}

	public static function save_routes() {
		$project_id = self::project_id();
		$raw = isset( $_POST['routes'] ) ? wp_unslash( $_POST['routes'] ) : '[]';
		$routes = json_decode( $raw, true );
		if ( ! is_array( $routes ) ) { $routes = []; }
		$routes = Route_Collection::save_project_routes( $project_id, $routes );
		$active_route_id = isset( $_POST['active_route_id'] ) ? sanitize_key( wp_unslash( $_POST['active_route_id'] ) ) : ( $routes[0]['id'] ?? Route_Collection::DEFAULT_ROUTE_ID );
		update_post_meta( $project_id, '_swm_active_route_id', $active_route_id );
		wp_send_json_success( [ 'active_route_id' => $active_route_id, 'routes' => $routes ] );
	}
}
