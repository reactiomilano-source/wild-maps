<?php
namespace WildMaps;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Forward-compatible .wmap import/export adapter for Wild Maps 1.3.
 *
 * This class intentionally leaves the existing 1.2 editor data untouched while
 * introducing a `routes` collection in exported .wmap files. During import it
 * accepts both the legacy single-route shape and the new multi-route shape.
 */
class Wmap_Compat {
	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) { self::$instance = new self(); }
		return self::$instance;
	}

	private function __construct() {
		$plugin = Plugin::instance();
		remove_action( 'admin_post_wm_export_project', [ $plugin, 'admin_export_project' ] );
		remove_action( 'admin_post_wm_import_project', [ $plugin, 'admin_import_project' ] );
		add_action( 'admin_post_wm_export_project', [ $this, 'admin_export_project' ] );
		add_action( 'admin_post_wm_import_project', [ $this, 'admin_import_project' ] );
	}

	private function decode_json_meta( $project_id, $meta_key, $fallback ) {
		$raw = get_post_meta( $project_id, $meta_key, true );
		if ( '' === $raw || null === $raw ) { return $fallback; }
		$data = json_decode( $raw, true );
		return is_array( $data ) ? $data : $fallback;
	}

	private function default_route_style() {
		return [
			'color'   => '#e63b2e',
			'width'   => 4,
			'opacity' => 0.95,
		];
	}

	private function legacy_route_from_project( $project_id ) {
		$route     = $this->decode_json_meta( $project_id, '_swm_route_geojson', null );
		$waypoints = $this->decode_json_meta( $project_id, '_swm_route_waypoints', [] );
		return [
			'id'        => 'route-main',
			'name'      => 'Main route',
			'visible'   => true,
			'locked'    => false,
			'style'     => $this->default_route_style(),
			'geojson'   => $route,
			'waypoints' => is_array( $waypoints ) ? $waypoints : [],
		];
	}

	private function routes_from_project( $project_id ) {
		$routes = $this->decode_json_meta( $project_id, '_swm_routes', [] );
		if ( empty( $routes ) || ! is_array( $routes ) ) {
			$routes = [ $this->legacy_route_from_project( $project_id ) ];
		}
		return $this->normalize_routes( $routes );
	}

	private function normalize_routes( $routes ) {
		$normalized = [];
		foreach ( (array) $routes as $index => $route ) {
			if ( ! is_array( $route ) ) { continue; }
			$id = isset( $route['id'] ) ? sanitize_key( $route['id'] ) : '';
			if ( '' === $id ) { $id = 0 === $index ? 'route-main' : 'route-' . ( $index + 1 ); }
			$name = isset( $route['name'] ) ? sanitize_text_field( $route['name'] ) : '';
			if ( '' === $name ) { $name = 0 === $index ? 'Main route' : 'Route ' . ( $index + 1 ); }
			$style = isset( $route['style'] ) && is_array( $route['style'] ) ? $route['style'] : [];
			$style = wp_parse_args( $style, $this->default_route_style() );
			$normalized[] = [
				'id'        => $id,
				'name'      => $name,
				'visible'   => ! isset( $route['visible'] ) || (bool) $route['visible'],
				'locked'    => ! empty( $route['locked'] ),
				'style'     => [
					'color'   => sanitize_hex_color( $style['color'] ) ?: '#e63b2e',
					'width'   => max( 1, (float) $style['width'] ),
					'opacity' => max( 0, min( 1, (float) $style['opacity'] ) ),
				],
				'geojson'   => isset( $route['geojson'] ) && is_array( $route['geojson'] ) ? $route['geojson'] : null,
				'waypoints' => isset( $route['waypoints'] ) && is_array( $route['waypoints'] ) ? array_values( $route['waypoints'] ) : [],
			];
		}
		if ( empty( $normalized ) ) { $normalized[] = $this->legacy_route_from_project( 0 ); }
		return $normalized;
	}

	private function routes_from_wmap( $data ) {
		if ( isset( $data['routes'] ) && is_array( $data['routes'] ) ) {
			return $this->normalize_routes( $data['routes'] );
		}
		return $this->normalize_routes( [ [
			'id'        => 'route-main',
			'name'      => 'Main route',
			'visible'   => true,
			'locked'    => false,
			'style'     => $this->default_route_style(),
			'geojson'   => isset( $data['route'] ) && is_array( $data['route'] ) ? $data['route'] : null,
			'waypoints' => isset( $data['stops'] ) && is_array( $data['stops'] ) ? $data['stops'] : [],
		] ] );
	}

	private function project_points_payload( $project_id ) {
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
			$points[] = [
				'name'        => get_the_title( $post ),
				'lat'         => (float) str_replace( ',', '.', get_post_meta( $post->ID, '_swm_lat', true ) ),
				'lng'         => (float) str_replace( ',', '.', get_post_meta( $post->ID, '_swm_lng', true ) ),
				'category'    => get_post_meta( $post->ID, '_swm_category', true ),
				'icon_url'    => get_post_meta( $post->ID, '_swm_icon_url', true ),
				'label'       => get_post_meta( $post->ID, '_swm_label', true ) === '0' ? '0' : '1',
				'description' => get_post_meta( $post->ID, '_swm_description', true ),
				'order'       => (int) get_post_meta( $post->ID, '_swm_order', true ),
			];
		}
		return $points;
	}

	private function wmap_project_payload( $project_id ) {
		$project = get_post( $project_id );
		if ( ! $project || 'swm_map_project' !== $project->post_type ) { return null; }

		$routes = $this->routes_from_project( $project_id );
		$main   = $routes[0];

		return [
			'wmap'           => 'wild-maps-project',
			'format'         => 'wmap',
			'format_version' => defined( 'SWM_WMAP_FORMAT_VERSION' ) ? SWM_WMAP_FORMAT_VERSION : '1.3',
			'plugin'         => [
				'name'    => 'Wild Maps',
				'version' => SWM_VERSION,
			],
			'exported_at'    => gmdate( 'c' ),
			'site'           => [
				'name' => get_bloginfo( 'name' ),
				'url'  => home_url( '/' ),
			],
			'project'        => [
				'title'       => get_the_title( $project ),
				'slug'        => $project->post_name,
				'description' => $project->post_excerpt,
			],
			'routes'         => $routes,
			'route'          => $main['geojson'],
			'stops'          => $main['waypoints'],
			'poi'            => $this->project_points_payload( $project_id ),
			'settings'       => [
				'roadbook_name_mode' => get_option( 'swm_roadbook_name_mode', 'latin' ),
			],
		];
	}

	public function admin_export_project() {
		if ( ! current_user_can( 'edit_posts' ) ) { wp_die( 'Permessi insufficienti.' ); }
		if ( ! isset( $_POST['wm_export_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['wm_export_nonce'] ) ), 'wm_export_project' ) ) { wp_die( 'Nonce non valido.' ); }
		$project_id = isset( $_POST['project_id'] ) ? absint( $_POST['project_id'] ) : 0;
		$payload = $this->wmap_project_payload( $project_id );
		if ( ! $payload ) { wp_die( 'Progetto non valido.' ); }
		$filename = sanitize_file_name( ( $payload['project']['title'] ?: 'wild-maps-project' ) . '.wmap' );
		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
		header( 'X-Content-Type-Options: nosniff' );
		echo wp_json_encode( $payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		exit;
	}

	private function redirect_import_export( $args = [] ) {
		$url = add_query_arg( $args, admin_url( 'admin.php?page=wild-maps-import-export' ) );
		wp_safe_redirect( $url );
		exit;
	}

	public function admin_import_project() {
		if ( ! current_user_can( 'edit_posts' ) ) { wp_die( 'Permessi insufficienti.' ); }
		if ( ! isset( $_POST['wm_import_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['wm_import_nonce'] ) ), 'wm_import_project' ) ) { wp_die( 'Nonce non valido.' ); }
		if ( empty( $_FILES['wmap_file']['tmp_name'] ) || ! is_uploaded_file( $_FILES['wmap_file']['tmp_name'] ) ) {
			$this->redirect_import_export( [ 'wm_error' => rawurlencode( 'Seleziona un file .wmap valido.' ) ] );
		}

		$raw = file_get_contents( $_FILES['wmap_file']['tmp_name'] ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) || ( $data['wmap'] ?? '' ) !== 'wild-maps-project' ) {
			$this->redirect_import_export( [ 'wm_error' => rawurlencode( 'Il file non sembra un progetto Wild Maps valido.' ) ] );
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
		if ( is_wp_error( $project_id ) ) {
			$this->redirect_import_export( [ 'wm_error' => rawurlencode( $project_id->get_error_message() ) ] );
		}

		$routes = $this->routes_from_wmap( $data );
		$main   = $routes[0];
		update_post_meta( $project_id, '_swm_routes', wp_slash( wp_json_encode( $routes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
		if ( isset( $main['geojson'] ) && is_array( $main['geojson'] ) ) {
			update_post_meta( $project_id, '_swm_route_geojson', wp_slash( wp_json_encode( $main['geojson'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
		} else {
			delete_post_meta( $project_id, '_swm_route_geojson' );
		}
		update_post_meta( $project_id, '_swm_route_waypoints', wp_slash( wp_json_encode( $main['waypoints'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );

		$created_points = 0;
		$poi = isset( $data['poi'] ) && is_array( $data['poi'] ) ? $data['poi'] : [];
		foreach ( $poi as $point ) {
			if ( ! is_array( $point ) ) { continue; }
			$name = sanitize_text_field( $point['name'] ?? '' );
			$lat  = isset( $point['lat'] ) ? (float) $point['lat'] : null;
			$lng  = isset( $point['lng'] ) ? (float) $point['lng'] : null;
			if ( '' === $name || null === $lat || null === $lng ) { continue; }
			$point_id = wp_insert_post( [
				'post_type'   => 'swm_map_point',
				'post_status' => 'publish',
				'post_title'  => $name,
			], true );
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

		$this->redirect_import_export( [ 'wm_message' => rawurlencode( 'Progetto importato: ' . $title . ' (' . count( $routes ) . ' route, ' . $created_points . ' POI).' ) ] );
	}
}
