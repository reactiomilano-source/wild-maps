<?php
namespace WildMaps\ImportExport;

use WildMaps\Core\Route_Collection;

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Wmap_Multi_Route {
	public static function init() {
		add_action( 'admin_post_wm_export_project', [ __CLASS__, 'export_project' ], 1 );
		add_action( 'admin_post_wm_import_project', [ __CLASS__, 'import_project' ], 1 );
	}

	private static function all_points( $project_id ) {
		$query = new \WP_Query( [
			'post_type'      => 'swm_map_point',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'meta_key'       => '_swm_order',
			'orderby'        => [ 'meta_value_num' => 'ASC', 'title' => 'ASC' ],
			'order'          => 'ASC',
			'meta_query'     => [ [ 'key' => '_swm_project_id', 'value' => (int) $project_id, 'compare' => '=' ] ],
		] );
		$points = [];
		foreach ( $query->posts as $post ) {
			$lat = get_post_meta( $post->ID, '_swm_lat', true );
			$lng = get_post_meta( $post->ID, '_swm_lng', true );
			if ( '' === $lat || '' === $lng ) { continue; }
			$points[] = [
				'name'        => get_the_title( $post ),
				'lat'         => (float) str_replace( ',', '.', $lat ),
				'lng'         => (float) str_replace( ',', '.', $lng ),
				'category'    => get_post_meta( $post->ID, '_swm_category', true ),
				'icon_url'    => get_post_meta( $post->ID, '_swm_icon_url', true ),
				'label'       => get_post_meta( $post->ID, '_swm_label', true ),
				'description' => get_post_meta( $post->ID, '_swm_description', true ),
				'order'       => (int) get_post_meta( $post->ID, '_swm_order', true ),
			];
		}
		return $points;
	}

	private static function payload( $project_id ) {
		$project = get_post( $project_id );
		if ( ! $project || 'swm_map_project' !== $project->post_type ) { return null; }
		$routes = Route_Collection::get_project_routes( $project_id );
		$active_route_id = get_post_meta( $project_id, '_swm_active_route_id', true );
		if ( ! $active_route_id && ! empty( $routes[0]['id'] ) ) { $active_route_id = $routes[0]['id']; }
		$legacy = $routes[0] ?? Route_Collection::default_route();
		return [
			'wmap'           => 'wild-maps-project',
			'format'         => 'wmap',
			'format_version' => defined( 'SWM_WMAP_FORMAT_VERSION' ) ? SWM_WMAP_FORMAT_VERSION : '1.3',
			'plugin'         => [ 'name' => 'Wild Maps', 'version' => SWM_VERSION ],
			'exported_at'    => gmdate( 'c' ),
			'site'           => [ 'name' => get_bloginfo( 'name' ), 'url' => home_url( '/' ) ],
			'project'        => [
				'title'       => get_the_title( $project ),
				'slug'        => $project->post_name,
				'description' => $project->post_excerpt,
			],
			'routes'         => $routes,
			'active_route_id'=> $active_route_id,
			'route'          => $legacy['geojson'] ?? null,
			'stops'          => $legacy['waypoints'] ?? [],
			'poi'            => self::all_points( $project_id ),
			'settings'       => [ 'roadbook_name_mode' => get_option( 'swm_roadbook_name_mode', 'latin' ) ],
		];
	}

	public static function export_project() {
		if ( ! current_user_can( 'edit_posts' ) ) { wp_die( 'Permessi insufficienti.' ); }
		if ( ! isset( $_POST['wm_export_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['wm_export_nonce'] ) ), 'wm_export_project' ) ) { wp_die( 'Nonce non valido.' ); }
		$project_id = isset( $_POST['project_id'] ) ? absint( $_POST['project_id'] ) : 0;
		$payload = self::payload( $project_id );
		if ( ! $payload ) { wp_die( 'Progetto non valido.' ); }
		$filename = sanitize_file_name( ( $payload['project']['title'] ?: 'wild-maps-project' ) . '.wmap' );
		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
		header( 'X-Content-Type-Options: nosniff' );
		echo wp_json_encode( $payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		exit;
	}

	private static function redirect( $args = [] ) {
		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php?page=wild-maps-import-export' ) ) );
		exit;
	}

	private static function imported_routes( $data ) {
		if ( isset( $data['routes'] ) && is_array( $data['routes'] ) ) {
			$routes = Route_Collection::normalize_routes( $data['routes'] );
			if ( ! empty( $routes ) ) { return $routes; }
		}
		$route = isset( $data['route'] ) && is_array( $data['route'] ) ? $data['route'] : null;
		$stops = isset( $data['stops'] ) && is_array( $data['stops'] ) ? $data['stops'] : [];
		return [ Route_Collection::default_route( $route, $stops ) ];
	}

	public static function import_project() {
		if ( ! current_user_can( 'edit_posts' ) ) { wp_die( 'Permessi insufficienti.' ); }
		if ( ! isset( $_POST['wm_import_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['wm_import_nonce'] ) ), 'wm_import_project' ) ) { wp_die( 'Nonce non valido.' ); }
		if ( empty( $_FILES['wmap_file']['tmp_name'] ) || ! is_uploaded_file( $_FILES['wmap_file']['tmp_name'] ) ) {
			self::redirect( [ 'wm_error' => rawurlencode( 'Seleziona un file .wmap valido.' ) ] );
		}
		$raw = file_get_contents( $_FILES['wmap_file']['tmp_name'] ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) || ( $data['wmap'] ?? '' ) !== 'wild-maps-project' ) {
			self::redirect( [ 'wm_error' => rawurlencode( 'Il file non sembra un progetto Wild Maps valido.' ) ] );
		}
		$project_data = isset( $data['project'] ) && is_array( $data['project'] ) ? $data['project'] : [];
		$title = isset( $_POST['project_title'] ) && '' !== trim( (string) $_POST['project_title'] )
			? sanitize_text_field( wp_unslash( $_POST['project_title'] ) )
			: sanitize_text_field( $project_data['title'] ?? 'Imported Wild Maps Project' );
		if ( '' === $title ) { $title = 'Imported Wild Maps Project'; }
		$project_id = wp_insert_post( [
			'post_type'    => 'swm_map_project',
			'post_status'  => 'publish',
			'post_title'   => $title,
			'post_excerpt' => sanitize_textarea_field( $project_data['description'] ?? '' ),
		], true );
		if ( is_wp_error( $project_id ) ) { self::redirect( [ 'wm_error' => rawurlencode( $project_id->get_error_message() ) ] ); }
		$routes = Route_Collection::save_project_routes( $project_id, self::imported_routes( $data ) );
		$active = sanitize_key( $data['active_route_id'] ?? ( $routes[0]['id'] ?? Route_Collection::DEFAULT_ROUTE_ID ) );
		update_post_meta( $project_id, '_swm_active_route_id', $active );

		$created_points = 0;
		$poi = isset( $data['poi'] ) && is_array( $data['poi'] ) ? $data['poi'] : [];
		foreach ( $poi as $point ) {
			if ( ! is_array( $point ) ) { continue; }
			$name = sanitize_text_field( $point['name'] ?? '' );
			$lat = isset( $point['lat'] ) ? (float) $point['lat'] : null;
			$lng = isset( $point['lng'] ) ? (float) $point['lng'] : null;
			if ( '' === $name || null === $lat || null === $lng ) { continue; }
			$point_id = wp_insert_post( [ 'post_type' => 'swm_map_point', 'post_status' => 'publish', 'post_title' => $name ], true );
			if ( is_wp_error( $point_id ) ) { continue; }
			update_post_meta( $point_id, '_swm_project_id', (int) $project_id );
			update_post_meta( $point_id, '_swm_lat', (string) $lat );
			update_post_meta( $point_id, '_swm_lng', (string) $lng );
			update_post_meta( $point_id, '_swm_category', sanitize_text_field( $point['category'] ?? '' ) );
			update_post_meta( $point_id, '_swm_icon_url', esc_url_raw( $point['icon_url'] ?? '' ) );
			update_post_meta( $point_id, '_swm_label', ( isset( $point['label'] ) && '0' === (string) $point['label'] ) ? '0' : '1' );
			update_post_meta( $point_id, '_swm_description', sanitize_textarea_field( $point['description'] ?? '' ) );
			update_post_meta( $point_id, '_swm_order', isset( $point['order'] ) ? intval( $point['order'] ) : 0 );
			$created_points++;
		}
		self::redirect( [ 'wm_message' => rawurlencode( 'Progetto importato: ' . $title . ' (' . count( $routes ) . ' route, ' . $created_points . ' POI).' ) ] );
	}
}
