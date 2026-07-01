<?php
namespace WildMaps\Core;

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Route_Collection {
	const META_KEY = '_swm_routes';
	const DEFAULT_ROUTE_ID = 'route-main';

	public static function default_route( $route = null, $waypoints = [] ) {
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
		$id = isset( $route['id'] ) && '' !== trim( (string) $route['id'] ) ? sanitize_key( $route['id'] ) : ( 0 === $index ? self::DEFAULT_ROUTE_ID : 'route-' . ( $index + 1 ) );
		$name = isset( $route['name'] ) && '' !== trim( (string) $route['name'] ) ? sanitize_text_field( $route['name'] ) : ( self::DEFAULT_ROUTE_ID === $id ? 'Main route' : 'Route ' . ( $index + 1 ) );
		$style = isset( $route['style'] ) && is_array( $route['style'] ) ? $route['style'] : [];
		$waypoints = isset( $route['waypoints'] ) && is_array( $route['waypoints'] ) ? array_values( $route['waypoints'] ) : [];
		$geojson = isset( $route['geojson'] ) && is_array( $route['geojson'] ) ? $route['geojson'] : null;

		return [
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
	}

	public static function normalize_routes( $routes ) {
		$out = [];
		foreach ( (array) $routes as $index => $route ) {
			$normalized = self::normalize_route( $route, (int) $index );
			if ( $normalized ) { $out[] = $normalized; }
		}
		return $out;
	}

	public static function get_project_routes( $project_id ) {
		$stored = $project_id ? get_post_meta( $project_id, self::META_KEY, true ) : '';
		if ( $stored ) {
			$decoded = is_string( $stored ) ? json_decode( $stored, true ) : $stored;
			$routes = self::normalize_routes( $decoded );
			if ( ! empty( $routes ) ) { return $routes; }
		}

		$route_raw = $project_id ? get_post_meta( $project_id, '_swm_route_geojson', true ) : '';
		$waypoints_raw = $project_id ? get_post_meta( $project_id, '_swm_route_waypoints', true ) : '';
		$route = $route_raw ? json_decode( $route_raw, true ) : null;
		$waypoints = $waypoints_raw ? json_decode( $waypoints_raw, true ) : [];
		if ( ! is_array( $waypoints ) ) { $waypoints = []; }

		return [ self::default_route( is_array( $route ) ? $route : null, $waypoints ) ];
	}

	public static function save_project_routes( $project_id, $routes ) {
		$routes = self::normalize_routes( $routes );
		if ( empty( $routes ) ) { $routes = [ self::default_route() ]; }
		update_post_meta( $project_id, self::META_KEY, wp_slash( wp_json_encode( $routes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
		self::sync_legacy_route_meta( $project_id, $routes[0] );
		return $routes;
	}

	public static function sync_legacy_route_meta( $project_id, $route ) {
		$route = self::normalize_route( $route, 0 );
		if ( ! $route ) { return; }
		if ( is_array( $route['geojson'] ) ) {
			update_post_meta( $project_id, '_swm_route_geojson', wp_slash( wp_json_encode( $route['geojson'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
		} else {
			delete_post_meta( $project_id, '_swm_route_geojson' );
		}
		update_post_meta( $project_id, '_swm_route_waypoints', wp_slash( wp_json_encode( $route['waypoints'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
	}

	public static function payload( $project_id ) {
		$routes = self::get_project_routes( $project_id );
		return [
			'active_route_id' => $routes[0]['id'] ?? self::DEFAULT_ROUTE_ID,
			'routes'          => $routes,
		];
	}
}
