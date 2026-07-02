<?php
namespace WildMaps\Core;

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Frontend_Routes_REST {
	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ], 20 );
	}

	public static function register_routes() {
		register_rest_route( 'wild-maps/v1', '/route', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'project_route' ],
			'permission_callback' => '__return_true',
			'args'                => [ 'project_id' => [ 'required' => false, 'sanitize_callback' => 'absint' ] ],
		], true );
	}

	private static function empty_collection() {
		return [ 'type' => 'FeatureCollection', 'features' => [] ];
	}

	private static function decode_meta_json( $project_id, $key, $fallback = null ) {
		$raw = get_post_meta( $project_id, $key, true );
		if ( '' === $raw || null === $raw ) { return $fallback; }
		$data = json_decode( $raw, true );
		return is_array( $data ) ? $data : $fallback;
	}

	private static function default_style() {
		return [ 'color' => '#e63b2e', 'width' => 4, 'opacity' => 0.95 ];
	}

	private static function normalize_style( $style ) {
		$style = is_array( $style ) ? wp_parse_args( $style, self::default_style() ) : self::default_style();
		return [
			'color'   => sanitize_hex_color( $style['color'] ?? '' ) ?: '#e63b2e',
			'width'   => max( 1, min( 20, (float) ( $style['width'] ?? 4 ) ) ),
			'opacity' => max( 0, min( 1, (float) ( $style['opacity'] ?? 0.95 ) ) ),
		];
	}

	private static function add_geojson_features( &$features, $geojson, $route ) {
		if ( ! is_array( $geojson ) ) { return; }
		$style = self::normalize_style( $route['style'] ?? [] );
		$name  = sanitize_text_field( $route['name'] ?? $route['id'] ?? 'Route' );
		$id    = sanitize_key( $route['id'] ?? 'route-main' );

		$items = [];
		if ( isset( $geojson['type'] ) && 'FeatureCollection' === $geojson['type'] && ! empty( $geojson['features'] ) && is_array( $geojson['features'] ) ) {
			$items = $geojson['features'];
		} elseif ( isset( $geojson['type'] ) && 'Feature' === $geojson['type'] ) {
			$items = [ $geojson ];
		} elseif ( ! empty( $geojson['type'] ) && ! empty( $geojson['coordinates'] ) ) {
			$items = [ [ 'type' => 'Feature', 'properties' => [], 'geometry' => $geojson ] ];
		}

		foreach ( $items as $feature ) {
			if ( empty( $feature['geometry']['type'] ) || ! in_array( $feature['geometry']['type'], [ 'LineString', 'MultiLineString' ], true ) ) { continue; }
			$properties = isset( $feature['properties'] ) && is_array( $feature['properties'] ) ? $feature['properties'] : [];
			$features[] = [
				'type'       => 'Feature',
				'properties' => array_merge( $properties, [
					'swm_route_id'      => $id,
					'swm_route_name'    => $name,
					'swm_route_color'   => $style['color'],
					'swm_route_width'   => $style['width'],
					'swm_route_opacity' => $style['opacity'],
				] ),
				'geometry'   => $feature['geometry'],
			];
		}
	}

	private static function collection_from_routes( $project_id ) {
		$routes = self::decode_meta_json( $project_id, '_swm_routes', [] );
		$features = [];

		if ( is_array( $routes ) && ! empty( $routes ) ) {
			foreach ( $routes as $route ) {
				if ( ! is_array( $route ) || ( isset( $route['visible'] ) && false === (bool) $route['visible'] ) ) { continue; }
				self::add_geojson_features( $features, $route['geojson'] ?? null, $route );
			}
		}

		if ( empty( $features ) ) {
			$legacy_route = self::decode_meta_json( $project_id, '_swm_route_geojson', null );
			self::add_geojson_features( $features, $legacy_route, [
				'id'      => 'route-main',
				'name'    => 'Main route',
				'visible' => true,
				'style'   => self::default_style(),
			] );
		}

		return [ 'type' => 'FeatureCollection', 'features' => $features ];
	}

	private static function fallback_project_id() {
		$ids = get_posts( [
			'post_type'      => 'swm_map_project',
			'post_status'    => 'publish',
			'posts_per_page' => 1,
			'orderby'        => 'modified',
			'order'          => 'DESC',
			'fields'         => 'ids',
			'meta_query'     => [
				'relation' => 'OR',
				[ 'key' => '_swm_routes', 'compare' => 'EXISTS' ],
				[ 'key' => '_swm_route_geojson', 'compare' => 'EXISTS' ],
			],
		] );
		return ! empty( $ids[0] ) ? (int) $ids[0] : 0;
	}

	public static function project_route( $request ) {
		$project_id = isset( $request['project_id'] ) ? absint( $request['project_id'] ) : 0;
		if ( ! $project_id ) { $project_id = self::fallback_project_id(); }
		if ( ! $project_id || 'swm_map_project' !== get_post_type( $project_id ) ) {
			return rest_ensure_response( self::empty_collection() );
		}
		return rest_ensure_response( self::collection_from_routes( $project_id ) );
	}
}
