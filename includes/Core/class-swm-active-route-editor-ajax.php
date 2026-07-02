<?php
namespace WildMaps\Core;

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Active_Route_Editor_Ajax {
	public static function init() {
		add_action( 'wp_' . 'ajax_swm_admin_get_route', [ __CLASS__, 'get_active_route' ], 1 );
		add_action( 'wp_' . 'ajax_swm_admin_save_route', [ __CLASS__, 'save_active_route' ], 1 );
	}

	private static function project_id() {
		check_ajax_referer( 'swm_admin_points', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( [ 'message' => 'Permessi insufficienti.' ], 403 );
		}
		$project_id = isset( $_POST['project_id'] ) ? absint( $_POST['project_id'] ) : 0;
		if ( ! $project_id || 'swm_map_project' !== get_post_type( $project_id ) ) {
			wp_send_json_error( [ 'message' => 'Seleziona prima un Progetto Mappa.' ], 400 );
		}
		return $project_id;
	}

	private static function active_route_id( $project_id, $routes ) {
		$active = get_post_meta( $project_id, '_swm_active_route_id', true );
		if ( $active ) {
			foreach ( $routes as $route ) {
				if ( isset( $route['id'] ) && (string) $route['id'] === (string) $active ) { return (string) $active; }
			}
		}
		return $routes[0]['id'] ?? '';
	}

	private static function find_active_index( $routes, $active_route_id ) {
		foreach ( $routes as $index => $route ) {
			if ( isset( $route['id'] ) && (string) $route['id'] === (string) $active_route_id ) { return (int) $index; }
		}
		return -1;
	}

	public static function get_active_route() {
		$project_id = self::project_id();
		$routes = Route_Collection::get_project_routes( $project_id );
		$active_route_id = self::active_route_id( $project_id, $routes );
		$index = self::find_active_index( $routes, $active_route_id );
		$route = $index >= 0 && isset( $routes[ $index ] ) ? $routes[ $index ] : null;

		wp_send_json_success( [
			'route' => $route['geojson'] ?? null,
			'waypoints' => isset( $route['waypoints'] ) && is_array( $route['waypoints'] ) ? array_values( $route['waypoints'] ) : [],
			'active_route_id' => $route['id'] ?? $active_route_id,
		] );
	}

	public static function save_active_route() {
		$project_id = self::project_id();
		$route_raw = isset( $_POST['route'] ) ? wp_unslash( $_POST['route'] ) : '';
		$waypoints_raw = isset( $_POST['waypoints'] ) ? wp_unslash( $_POST['waypoints'] ) : '[]';
		$allow_empty_route = ! empty( $_POST['allow_empty_route'] );
		$route_geojson = '' !== $route_raw ? json_decode( $route_raw, true ) : null;
		$waypoints = json_decode( $waypoints_raw, true );
		if ( ! is_array( $waypoints ) ) { $waypoints = []; }
		if ( '' !== $route_raw && ! is_array( $route_geojson ) ) {
			wp_send_json_error( [ 'message' => 'Percorso GeoJSON non valido.' ], 400 );
		}
		if ( '' === $route_raw && ! $allow_empty_route ) {
			wp_send_json_error( [ 'message' => 'Percorso GeoJSON non valido.' ], 400 );
		}

		$routes = Route_Collection::get_project_routes( $project_id );
		$active_route_id = self::active_route_id( $project_id, $routes );
		$index = self::find_active_index( $routes, $active_route_id );
		if ( $index < 0 || empty( $routes[ $index ] ) ) {
			wp_send_json_error( [ 'message' => 'Nessuna route attiva da salvare.' ], 400 );
		}
		$routes[ $index ]['geojson'] = is_array( $route_geojson ) ? $route_geojson : null;
		$routes[ $index ]['waypoints'] = array_values( $waypoints );
		$routes = Route_Collection::save_project_routes( $project_id, $routes );
		update_post_meta( $project_id, '_swm_active_route_id', $routes[ $index ]['id'] ?? $active_route_id );

		wp_send_json_success( [
			'route' => $routes[ $index ]['geojson'] ?? null,
			'waypoints' => $routes[ $index ]['waypoints'] ?? [],
			'active_route_id' => $routes[ $index ]['id'] ?? $active_route_id,
		] );
	}
}
