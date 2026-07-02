<?php
namespace WildMaps\Core;

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Route_Collection {
	const META_KEY = '_swm_routes';
	const DEFAULT_ROUTE_ID = 'route-main';

	private static $syncing = false;
	private static $debug = [];

	private static function summarize_routes( $routes ) {
		$out = [];
		foreach ( (array) $routes as $index => $route ) {
			$out[] = [
				'index' => (int) $index,
				'id' => is_array( $route ) ? ( $route['id'] ?? null ) : null,
				'name' => is_array( $route ) ? ( $route['name'] ?? null ) : null,
				'has_geojson' => is_array( $route ) && isset( $route['geojson'] ) && is_array( $route['geojson'] ),
				'waypoints_count' => is_array( $route ) && isset( $route['waypoints'] ) && is_array( $route['waypoints'] ) ? count( $route['waypoints'] ) : 0,
			];
		}
		return $out;
	}

	public static function debug_note( $event, $data = [] ) {
		$item = array_merge( [ 'event' => $event ], is_array( $data ) ? $data : [] );
		self::$debug[] = $item;
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) { error_log( '[SWM ROUTE DEBUG] ' . wp_json_encode( $item ) ); }
	}

	public static function debug_dump() { return self::$debug; }
	public static function debug_routes( $routes ) { return self::summarize_routes( $routes ); }

	public static function init() {
		add_action( 'updated_post_meta', [ __CLASS__, 'maybe_sync_from_legacy_meta' ], 10, 4 );
		add_action( 'added_post_meta', [ __CLASS__, 'maybe_sync_from_legacy_meta' ], 10, 4 );
	}

	public static function default_route( $route = null, $waypoints = [] ) {
		self::debug_note( 'default_route_called', [ 'has_route' => is_array( $route ), 'waypoints_count' => is_array( $waypoints ) ? count( $waypoints ) : 0 ] );
		return [
			'id'        => self::DEFAULT_ROUTE_ID,
			'name'      => 'Main route',
			'visible'   => true,
			'locked'    => false,
			'style'     => [
				'color'   => '#e63b2e',
				'width'   => 4,
				'opacity' => 0.95,
			],
			'geojson'   => is_array( $route ) ? $route : null,
			'waypoints' => is_array( $waypoints ) ? array_values( $waypoints ) : [],
		];
	}

	public static function normalize_route( $route, $index = 0 ) {
		if ( ! is_array( $route ) ) { return null; }
		self::debug_note( 'normalize_route_input', [ 'index' => (int) $index, 'id' => $route['id'] ?? null, 'name' => $route['name'] ?? null ] );
		$id = isset( $route['id'] ) && '' !== trim( (string) $route['id'] ) ? sanitize_key( $route['id'] ) : ( 0 === $index ? self::DEFAULT_ROUTE_ID : 'route-' . ( $index + 1 ) );
		$name = isset( $route['name'] ) && '' !== trim( (string) $route['name'] ) ? sanitize_text_field( $route['name'] ) : ( self::DEFAULT_ROUTE_ID === $id ? 'Main route' : 'Route ' . ( $index + 1 ) );
		$style = isset( $route['style'] ) && is_array( $route['style'] ) ? $route['style'] : [];
		$waypoints = isset( $route['waypoints'] ) && is_array( $route['waypoints'] ) ? array_values( $route['waypoints'] ) : [];
		$geojson = isset( $route['geojson'] ) && is_array( $route['geojson'] ) ? $route['geojson'] : null;

		$normalized = [
			'id'        => $id,
			'name'      => $name,
			'visible'   => ! isset( $route['visible'] ) || false !== (bool) $route['visible'],
			'locked'    => ! empty( $route['locked'] ),
			'style'     => [
				'color'   => sanitize_hex_color( $style['color'] ?? '#e63b2e' ) ?: '#e63b2e',
				'width'   => isset( $style['width'] ) ? max( 1, min( 20, (float) $style['width'] ) ) : 4,
				'opacity' => isset( $style['opacity'] ) ? max( 0, min( 1, (float) $style['opacity'] ) ) : 0.95,
			],
			'geojson'   => $geojson,
			'waypoints' => $waypoints,
		];
		self::debug_note( 'normalize_route_output', [ 'index' => (int) $index, 'id' => $normalized['id'], 'name' => $normalized['name'] ] );
		return $normalized;
	}

	public static function normalize_routes( $routes ) {
		self::debug_note( 'normalize_routes_input', [ 'routes' => self::summarize_routes( $routes ) ] );
		$out = [];
		foreach ( (array) $routes as $index => $route ) {
			$normalized = self::normalize_route( $route, (int) $index );
			if ( $normalized ) { $out[] = $normalized; }
		}
		self::debug_note( 'normalize_routes_output', [ 'routes' => self::summarize_routes( $out ) ] );
		return $out;
	}

	public static function get_project_routes( $project_id ) {
		$stored = $project_id ? get_post_meta( $project_id, self::META_KEY, true ) : '';
		self::debug_note( 'get_project_routes_start', [ 'project_id' => (int) $project_id, 'stored_exists' => (bool) $stored ] );
		if ( $stored ) {
			$decoded = is_string( $stored ) ? json_decode( $stored, true ) : $stored;
			$routes = self::normalize_routes( $decoded );
			self::debug_note( 'get_project_routes_from_meta', [ 'routes' => self::summarize_routes( $routes ) ] );
			if ( ! empty( $routes ) ) { return $routes; }
		}

		$route_raw = $project_id ? get_post_meta( $project_id, '_swm_route_geojson', true ) : '';
		$waypoints_raw = $project_id ? get_post_meta( $project_id, '_swm_route_waypoints', true ) : '';
		$route = $route_raw ? json_decode( $route_raw, true ) : null;
		$waypoints = $waypoints_raw ? json_decode( $waypoints_raw, true ) : [];
		if ( ! is_array( $waypoints ) ) { $waypoints = []; }
		self::debug_note( 'get_project_routes_legacy_fallback', [ 'has_route_raw' => (bool) $route_raw, 'has_waypoints_raw' => (bool) $waypoints_raw, 'waypoints_count' => count( $waypoints ) ] );
		return [ self::default_route( is_array( $route ) ? $route : null, $waypoints ) ];
	}

	public static function save_project_routes( $project_id, $routes ) {
		self::debug_note( 'save_project_routes_received', [ 'project_id' => (int) $project_id, 'routes' => self::summarize_routes( $routes ) ] );
		$routes = self::normalize_routes( $routes );
		self::$syncing = true;
		update_post_meta( $project_id, self::META_KEY, wp_slash( wp_json_encode( $routes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
		self::debug_note( 'save_project_routes_after_update_meta', [ 'routes' => self::summarize_routes( $routes ) ] );
		if ( ! empty( $routes ) ) {
			self::sync_legacy_route_meta( $project_id, $routes[0] );
		} else {
			delete_post_meta( $project_id, '_swm_route_geojson' );
			delete_post_meta( $project_id, '_swm_route_waypoints' );
			self::debug_note( 'save_project_routes_deleted_legacy_meta' );
		}
		self::$syncing = false;
		return $routes;
	}

	public static function sync_legacy_route_meta( $project_id, $route ) {
		self::debug_note( 'sync_legacy_route_meta_start', [ 'project_id' => (int) $project_id, 'route' => self::summarize_routes( [ $route ] ) ] );
		$route = self::normalize_route( $route, 0 );
		if ( ! $route ) { return; }
		if ( is_array( $route['geojson'] ) ) {
			update_post_meta( $project_id, '_swm_route_geojson', wp_slash( wp_json_encode( $route['geojson'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
		} else {
			delete_post_meta( $project_id, '_swm_route_geojson' );
		}
		update_post_meta( $project_id, '_swm_route_waypoints', wp_slash( wp_json_encode( $route['waypoints'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
		self::debug_note( 'sync_legacy_route_meta_done', [ 'route_id' => $route['id'], 'route_name' => $route['name'] ] );
	}

	public static function maybe_sync_from_legacy_meta( $meta_id, $project_id, $meta_key, $meta_value ) {
		self::debug_note( 'maybe_sync_from_legacy_meta_called', [ 'syncing' => self::$syncing, 'project_id' => (int) $project_id, 'meta_key' => $meta_key ] );
		if ( self::$syncing || ! in_array( $meta_key, [ '_swm_route_geojson', '_swm_route_waypoints' ], true ) ) { return; }
		if ( ! $project_id || 'swm_map_project' !== get_post_type( $project_id ) ) { return; }
		$routes = self::get_project_routes( $project_id );
		$main = $routes[0] ?? self::default_route();
		$route_raw = get_post_meta( $project_id, '_swm_route_geojson', true );
		$waypoints_raw = get_post_meta( $project_id, '_swm_route_waypoints', true );
		$route = $route_raw ? json_decode( $route_raw, true ) : null;
		$waypoints = $waypoints_raw ? json_decode( $waypoints_raw, true ) : [];
		$main['geojson'] = is_array( $route ) ? $route : null;
		$main['waypoints'] = is_array( $waypoints ) ? array_values( $waypoints ) : [];
		$routes[0] = self::normalize_route( $main, 0 );
		self::$syncing = true;
		update_post_meta( $project_id, self::META_KEY, wp_slash( wp_json_encode( $routes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
		self::$syncing = false;
		self::debug_note( 'maybe_sync_from_legacy_meta_updated_routes', [ 'routes' => self::summarize_routes( $routes ) ] );
	}

	public static function payload( $project_id ) {
		$routes = self::get_project_routes( $project_id );
		$payload = [
			'active_route_id' => $routes[0]['id'] ?? self::DEFAULT_ROUTE_ID,
			'routes'          => $routes,
		];
		self::debug_note( 'payload', [ 'payload_routes' => self::summarize_routes( $routes ), 'active_route_id' => $payload['active_route_id'] ] );
		return $payload;
	}
}
