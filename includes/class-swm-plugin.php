<?php
namespace WildMaps;

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Plugin {
	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) { self::$instance = new self(); }
		return self::$instance;
	}

	private function __construct() {
		add_filter( 'upload_mimes', [ $this, 'allow_geojson_uploads' ] );
		add_action( 'init', [ $this, 'register_map_projects_post_type' ] );
		add_action( 'init', [ $this, 'register_map_points_post_type' ] );
		add_action( 'admin_menu', [ $this, 'admin_menu' ] );
		add_action( 'admin_init', [ $this, 'register_settings' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'admin_enqueue_scripts' ] );
		add_action( 'wp_ajax_swm_admin_list_points', [ $this, 'ajax_list_points' ] );
		add_action( 'wp_ajax_swm_admin_save_point', [ $this, 'ajax_save_point' ] );
		add_action( 'wp_ajax_swm_admin_delete_point', [ $this, 'ajax_delete_point' ] );
		add_action( 'wp_ajax_swm_admin_get_route', [ $this, 'ajax_get_route' ] );
		add_action( 'wp_ajax_swm_admin_save_route', [ $this, 'ajax_save_route' ] );
		add_action( 'wp_ajax_swm_admin_ors_route', [ $this, 'ajax_ors_route' ] );
		add_action( 'wp_ajax_swm_admin_ors_geocode', [ $this, 'ajax_ors_geocode' ] );
		add_action( 'wp_ajax_swm_admin_route_pdf', [ $this, 'admin_route_pdf' ] );
		add_action( 'wp_enqueue_scripts', [ $this, 'register_assets' ] );
		add_action( 'elementor/frontend/after_register_scripts', [ $this, 'register_assets' ] );
		add_action( 'elementor/elements/categories_registered', [ $this, 'register_elementor_category' ] );
		add_action( 'elementor/widgets/register', [ $this, 'register_widgets' ] );
		add_action( 'add_meta_boxes', [ $this, 'register_map_point_metaboxes' ] );
		add_action( 'save_post_swm_map_point', [ $this, 'save_map_point' ] );
		add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
	}



	public function register_map_projects_post_type() {
		register_post_type( 'swm_map_project', [
			'labels' => [
				'name'          => 'Progetti Mappa',
				'singular_name' => 'Progetto Mappa',
				'add_new_item'  => 'Aggiungi Progetto Mappa',
				'edit_item'     => 'Modifica Progetto Mappa',
				'menu_name'     => 'Progetti Mappa',
			],
			'public'       => false,
			'show_ui'      => true,
			'show_in_menu' => false,
			'menu_icon'    => 'dashicons-admin-site-alt3',
			'supports'     => [ 'title' ],
			'show_in_rest' => true,
		] );
	}

	public static function get_map_projects_options() {
		$projects = get_posts( [
			'post_type'      => 'swm_map_project',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'orderby'        => 'title',
			'order'          => 'ASC',
		] );
		$options = [ '' => 'Tutti i progetti / nessun filtro' ];
		foreach ( $projects as $project ) {
			$options[ (string) $project->ID ] = $project->post_title;
		}
		return $options;
	}

	public function register_map_points_post_type() {
		register_post_type( 'swm_map_point', [
			'labels' => [
				'name'          => 'Punti Mappa',
				'singular_name' => 'Punto Mappa',
				'add_new_item'  => 'Aggiungi Punto Mappa',
				'edit_item'     => 'Modifica Punto Mappa',
				'menu_name'     => 'Punti Mappa',
			],
			'public'       => false,
			'show_ui'      => true,
			'show_in_menu' => false,
			'menu_icon'    => 'dashicons-location-alt',
			'supports'     => [ 'title' ],
			'show_in_rest' => true,
		] );
	}

	public function register_map_point_metaboxes() {
		add_meta_box(
			'swm_map_point_data',
			'Dati Punto Mappa',
			[ $this, 'render_map_point_metabox' ],
			'swm_map_point',
			'normal',
			'high'
		);
	}

	public function render_map_point_metabox( $post ) {
		wp_nonce_field( 'swm_save_map_point', 'swm_map_point_nonce' );
		$lat         = get_post_meta( $post->ID, '_swm_lat', true );
		$lng         = get_post_meta( $post->ID, '_swm_lng', true );
		$category    = get_post_meta( $post->ID, '_swm_category', true );
		$icon_url    = get_post_meta( $post->ID, '_swm_icon_url', true );
		$label       = get_post_meta( $post->ID, '_swm_label', true );
		$description = get_post_meta( $post->ID, '_swm_description', true );
		$order       = get_post_meta( $post->ID, '_swm_order', true );
		$project_id  = get_post_meta( $post->ID, '_swm_project_id', true );
		if ( '' === $label ) { $label = '1'; }
		?>
		<table class="form-table" role="presentation">
			<tr><th><label for="swm_project_id">Progetto Mappa</label></th><td><select id="swm_project_id" name="swm_project_id"><option value="">Nessun progetto / globale</option><?php foreach ( self::get_map_projects_options() as $pid => $pname ) : if ( '' === $pid ) { continue; } ?><option value="<?php echo esc_attr( $pid ); ?>" <?php selected( (string) $project_id, (string) $pid ); ?>><?php echo esc_html( $pname ); ?></option><?php endforeach; ?></select><p class="description">Il punto verrà caricato solo dalle mappe Elementor che selezionano questo progetto.</p></td></tr>
			<tr><th><label for="swm_lat">Latitudine</label></th><td><input type="text" id="swm_lat" name="swm_lat" value="<?php echo esc_attr( $lat ); ?>" class="regular-text" placeholder="43.0334" /></td></tr>
			<tr><th><label for="swm_lng">Longitudine</label></th><td><input type="text" id="swm_lng" name="swm_lng" value="<?php echo esc_attr( $lng ); ?>" class="regular-text" placeholder="42.6893" /></td></tr>
			<tr><th><label for="swm_category">Categoria</label></th><td><input type="text" id="swm_category" name="swm_category" value="<?php echo esc_attr( $category ); ?>" class="regular-text" placeholder="city, mountain, campsite..." /></td></tr>
			<tr><th><label for="swm_icon_url">Icona SVG/PNG opzionale</label></th><td><div class="swm-media-field"><input type="url" id="swm_icon_url" name="swm_icon_url" value="<?php echo esc_url( $icon_url ); ?>" class="large-text" placeholder="https://.../icona.svg" /> <button type="button" class="button swm-select-media" data-target="swm_icon_url">Scegli dalla libreria</button> <button type="button" class="button swm-clear-media" data-target="swm_icon_url">Rimuovi icona</button></div><p class="description">Se vuota, il widget cerca prima l'icona della categoria impostata in Elementor, poi l'icona backend generale.</p></td></tr>
			<tr><th><label for="swm_label">Etichetta</label></th><td><select id="swm_label" name="swm_label"><option value="1" <?php selected( $label, '1' ); ?>>Visibile</option><option value="0" <?php selected( $label, '0' ); ?>>Nascosta</option></select></td></tr>
			<tr><th><label for="swm_description">Descrizione popup</label></th><td><textarea id="swm_description" name="swm_description" rows="4" class="large-text"><?php echo esc_textarea( $description ); ?></textarea></td></tr>
			<tr><th><label for="swm_order">Ordine</label></th><td><input type="number" id="swm_order" name="swm_order" value="<?php echo esc_attr( $order ); ?>" class="small-text" /></td></tr>
		</table>
		<?php
	}

	public function save_map_point( $post_id ) {
		if ( ! isset( $_POST['swm_map_point_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['swm_map_point_nonce'] ) ), 'swm_save_map_point' ) ) { return; }
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) { return; }
		if ( ! current_user_can( 'edit_post', $post_id ) ) { return; }

		$fields = [
			'lat'         => 'text',
			'lng'         => 'text',
			'category'    => 'text',
			'icon_url'    => 'url',
			'label'       => 'text',
			'description' => 'textarea',
			'order'       => 'int',
			'project_id'  => 'int',
		];

		foreach ( $fields as $field => $type ) {
			$key = 'swm_' . $field;
			if ( ! isset( $_POST[ $key ] ) ) { continue; }
			$value = wp_unslash( $_POST[ $key ] );
			if ( 'url' === $type ) { $value = esc_url_raw( $value ); }
			elseif ( 'textarea' === $type ) { $value = sanitize_textarea_field( $value ); }
			elseif ( 'int' === $type ) { $value = intval( $value ); }
			else { $value = sanitize_text_field( $value ); }
			update_post_meta( $post_id, '_swm_' . $field, $value );
		}
	}

	public function register_rest_routes() {
		register_rest_route( 'wild-maps/v1', '/points', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_map_points' ],
			'permission_callback' => '__return_true',
			'args'                => [ 'project_id' => [ 'sanitize_callback' => 'absint' ] ],
		] );

		register_rest_route( 'wild-maps/v1', '/route', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_project_route' ],
			'permission_callback' => '__return_true',
			'args'                => [ 'project_id' => [ 'required' => true, 'sanitize_callback' => 'absint' ] ],
		] );
	}

	public function rest_map_points( $request ) {
		$project_id = isset( $request['project_id'] ) ? absint( $request['project_id'] ) : 0;
		$query_args = [
			'post_type'      => 'swm_map_point',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'meta_key'       => '_swm_order',
			'orderby'        => [ 'meta_value_num' => 'ASC', 'title' => 'ASC' ],
			'order'          => 'ASC',
		];
		if ( $project_id ) {
			$query_args['meta_query'] = [ [ 'key' => '_swm_project_id', 'value' => $project_id, 'compare' => '=' ] ];
		}
		$query = new \WP_Query( $query_args );

		$features = [];
		foreach ( $query->posts as $post ) {
			$lat = (float) str_replace( ',', '.', get_post_meta( $post->ID, '_swm_lat', true ) );
			$lng = (float) str_replace( ',', '.', get_post_meta( $post->ID, '_swm_lng', true ) );
			if ( ! $lat || ! $lng ) { continue; }
			$name        = get_the_title( $post );
			$category    = get_post_meta( $post->ID, '_swm_category', true );
			$icon_url    = get_post_meta( $post->ID, '_swm_icon_url', true );
			$label       = get_post_meta( $post->ID, '_swm_label', true );
			$description = get_post_meta( $post->ID, '_swm_description', true );

			$features[] = [
				'type'       => 'Feature',
				'properties' => [
					'swm_name'         => $name,
					'sw_name'          => $name,
					'swm_source'       => 'backend',
					'swm_category'     => $category,
					'swm_category_key' => sanitize_title( $category ),
					'swm_icon'         => $icon_url,
					'swm_label'        => ( '0' === $label ) ? '0' : '1',
					'description'      => $description,
				],
				'geometry'   => [
					'type'        => 'Point',
					'coordinates' => [ $lng, $lat ],
				],
			];
		}

		return rest_ensure_response( [ 'type' => 'FeatureCollection', 'features' => $features ] );
	}

	public function rest_project_route( $request ) {
		$project_id = isset( $request['project_id'] ) ? absint( $request['project_id'] ) : 0;
		if ( ! $project_id || 'swm_map_project' !== get_post_type( $project_id ) ) {
			return rest_ensure_response( [ 'type' => 'FeatureCollection', 'features' => [] ] );
		}
		$route = get_post_meta( $project_id, '_swm_route_geojson', true );
		if ( empty( $route ) ) { return rest_ensure_response( [ 'type' => 'FeatureCollection', 'features' => [] ] ); }
		$data = json_decode( $route, true );
		if ( ! is_array( $data ) ) { return rest_ensure_response( [ 'type' => 'FeatureCollection', 'features' => [] ] ); }
		return rest_ensure_response( $data );
	}

	private function get_project_route_payload( $project_id ) {
		$route = $project_id ? get_post_meta( $project_id, '_swm_route_geojson', true ) : '';
		$waypoints = $project_id ? get_post_meta( $project_id, '_swm_route_waypoints', true ) : '';
		return [
			'route' => $route ? json_decode( $route, true ) : null,
			'waypoints' => $waypoints ? json_decode( $waypoints, true ) : [],
		];
	}

	public function ajax_get_route() {
		check_ajax_referer( 'swm_admin_points', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) { wp_send_json_error( [ 'message' => 'Permessi insufficienti.' ], 403 ); }
		$project_id = isset( $_POST['project_id'] ) ? absint( $_POST['project_id'] ) : 0;
		wp_send_json_success( $this->get_project_route_payload( $project_id ) );
	}

	public function ajax_save_route() {
		check_ajax_referer( 'swm_admin_points', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) { wp_send_json_error( [ 'message' => 'Permessi insufficienti.' ], 403 ); }
		$project_id = isset( $_POST['project_id'] ) ? absint( $_POST['project_id'] ) : 0;
		if ( ! $project_id || 'swm_map_project' !== get_post_type( $project_id ) ) { wp_send_json_error( [ 'message' => 'Seleziona prima un Progetto Mappa.' ], 400 ); }
		$route_raw = isset( $_POST['route'] ) ? wp_unslash( $_POST['route'] ) : '';
		$waypoints_raw = isset( $_POST['waypoints'] ) ? wp_unslash( $_POST['waypoints'] ) : '[]';
		$allow_empty_route = ! empty( $_POST['allow_empty_route'] );
		$route = $route_raw !== '' ? json_decode( $route_raw, true ) : null;
		$waypoints = json_decode( $waypoints_raw, true );
		if ( ! is_array( $waypoints ) ) { $waypoints = []; }
		if ( is_array( $route ) ) {
			update_post_meta( $project_id, '_swm_route_geojson', wp_slash( wp_json_encode( $route, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
		} elseif ( $allow_empty_route ) {
			delete_post_meta( $project_id, '_swm_route_geojson' );
		} else {
			wp_send_json_error( [ 'message' => 'Percorso GeoJSON non valido.' ], 400 );
		}
		update_post_meta( $project_id, '_swm_route_waypoints', wp_slash( wp_json_encode( $waypoints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
		wp_send_json_success( $this->get_project_route_payload( $project_id ) );
	}

	public function ajax_ors_geocode() {
		check_ajax_referer( 'swm_admin_points', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) { wp_send_json_error( [ 'message' => 'Permessi insufficienti.' ], 403 ); }
		$api_key = self::openrouteservice_key();
		if ( ! $api_key ) { wp_send_json_error( [ 'message' => 'Inserisci la OpenRouteService API Key in Wild Maps > Impostazioni.' ], 400 ); }
		$text = isset( $_POST['text'] ) ? sanitize_text_field( wp_unslash( $_POST['text'] ) ) : '';
		if ( mb_strlen( $text ) < 2 ) { wp_send_json_success( [ 'results' => [] ] ); }

		$query_args = [
			'api_key' => $api_key,
			'text'    => $text,
			'size'    => 8,
			'lang'    => 'en',
		];

		$http_args = [
			'timeout' => 15,
			'headers' => [
				'Accept'        => 'application/json',
				'Authorization' => $api_key,
				'User-Agent'    => 'WildMaps/' . SWM_VERSION . '; ' . home_url( '/' ),
			],
		];

		// Prima prova: autocomplete Pelias/ORS. Seconda prova: geocode search come fallback.
		$endpoints = [
			'https://api.openrouteservice.org/geocode/autocomplete',
			'https://api.openrouteservice.org/geocode/search',
		];

		$data = null;
		$last_error = '';
		$last_code = 500;
		foreach ( $endpoints as $endpoint ) {
			$url = add_query_arg( $query_args, $endpoint );
			$response = wp_remote_get( $url, $http_args );
			if ( is_wp_error( $response ) ) {
				$last_error = $response->get_error_message();
				continue;
			}
			$last_code = wp_remote_retrieve_response_code( $response );
			$body = wp_remote_retrieve_body( $response );
			$decoded = json_decode( $body, true );
			if ( $last_code >= 200 && $last_code < 300 && is_array( $decoded ) ) {
				$data = $decoded;
				break;
			}
			$last_error = is_array( $decoded ) && isset( $decoded['error']['message'] ) ? $decoded['error']['message'] : 'OpenRouteService non ha restituito suggerimenti validi.';
		}

		$results = [];
		if ( is_array( $data ) && ! empty( $data['features'] ) && is_array( $data['features'] ) ) {
			foreach ( $data['features'] as $feature ) {
				$coords = $feature['geometry']['coordinates'] ?? null;
				$props  = $feature['properties'] ?? [];
				if ( ! is_array( $coords ) || count( $coords ) < 2 ) { continue; }
				$name = $props['name'] ?? '';
				$label = $props['label'] ?? $name;
				$results[] = [
					'name'    => sanitize_text_field( $name ),
					'label'   => sanitize_text_field( $label ),
					'lat'     => (float) $coords[1],
					'lng'     => (float) $coords[0],
					'country' => sanitize_text_field( $props['country'] ?? '' ),
					'region'  => sanitize_text_field( $props['region'] ?? '' ),
				];
			}
		}

		// Fallback robusto: se ORS Geocode non risponde o non restituisce risultati,
		// usiamo Nominatim con accept-language=en per mantenere i nomi in caratteri latini quando disponibili.
		if ( empty( $results ) ) {
			$nominatim_url = add_query_arg( [
				'q'              => $text,
				'format'         => 'jsonv2',
				'limit'          => 8,
				'addressdetails' => 1,
				'namedetails'    => 1,
				'accept-language'=> 'en',
			], 'https://nominatim.openstreetmap.org/search' );

			$nominatim_response = wp_remote_get( $nominatim_url, [
				'timeout' => 15,
				'headers' => [
					'Accept'     => 'application/json',
					'User-Agent' => 'WildMaps/' . SWM_VERSION . '; ' . home_url( '/' ),
				],
			] );

			if ( ! is_wp_error( $nominatim_response ) ) {
				$nominatim_code = wp_remote_retrieve_response_code( $nominatim_response );
				$nominatim_body = wp_remote_retrieve_body( $nominatim_response );
				$nominatim_data = json_decode( $nominatim_body, true );
				if ( $nominatim_code >= 200 && $nominatim_code < 300 && is_array( $nominatim_data ) ) {
					foreach ( $nominatim_data as $item ) {
						$lat = isset( $item['lat'] ) ? (float) $item['lat'] : null;
						$lng = isset( $item['lon'] ) ? (float) $item['lon'] : null;
						if ( null === $lat || null === $lng ) { continue; }
						$namedetails = isset( $item['namedetails'] ) && is_array( $item['namedetails'] ) ? $item['namedetails'] : [];
						$name = $namedetails['name:en'] ?? $item['name'] ?? $item['display_name'] ?? '';
						$label = $item['display_name'] ?? $name;
						$address = isset( $item['address'] ) && is_array( $item['address'] ) ? $item['address'] : [];
						$results[] = [
							'name'    => sanitize_text_field( $name ),
							'label'   => sanitize_text_field( $label ),
							'lat'     => $lat,
							'lng'     => $lng,
							'country' => sanitize_text_field( $address['country'] ?? '' ),
							'region'  => sanitize_text_field( $address['state'] ?? $address['region'] ?? '' ),
						];
					}
				}
			}
		}

		if ( empty( $results ) && ! empty( $last_error ) ) {
			wp_send_json_error( [ 'message' => 'Nessun risultato trovato. ORS: ' . $last_error ], $last_code && $last_code < 500 ? 200 : 500 );
		}

		wp_send_json_success( [ 'results' => $results ] );
	}

	public function ajax_ors_route() {
		check_ajax_referer( 'swm_admin_points', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) { wp_send_json_error( [ 'message' => 'Permessi insufficienti.' ], 403 ); }
		$api_key = self::openrouteservice_key();
		if ( ! $api_key ) { wp_send_json_error( [ 'message' => 'Inserisci la OpenRouteService API Key in Wild Maps > Impostazioni.' ], 400 ); }
		$profile = isset( $_POST['profile'] ) ? sanitize_key( wp_unslash( $_POST['profile'] ) ) : 'driving-car';
		$allowed = [ 'driving-car', 'cycling-regular', 'foot-walking', 'foot-hiking' ];
		if ( ! in_array( $profile, $allowed, true ) ) { $profile = 'driving-car'; }
		$coords_raw = isset( $_POST['coordinates'] ) ? wp_unslash( $_POST['coordinates'] ) : '[]';
		$coordinates = json_decode( $coords_raw, true );
		if ( ! is_array( $coordinates ) || count( $coordinates ) < 2 ) { wp_send_json_error( [ 'message' => 'Servono almeno 2 tappe per calcolare il percorso.' ], 400 ); }
		$clean = [];
		foreach ( $coordinates as $coord ) {
			if ( ! is_array( $coord ) || count( $coord ) < 2 ) { continue; }
			$lng = floatval( $coord[0] ); $lat = floatval( $coord[1] );
			if ( $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180 ) { continue; }
			$clean[] = [ $lng, $lat ];
		}
		if ( count( $clean ) < 2 ) { wp_send_json_error( [ 'message' => 'Coordinate non valide.' ], 400 ); }
		$url = 'https://api.openrouteservice.org/v2/directions/' . rawurlencode( $profile ) . '/geojson';
		$response = wp_remote_post( $url, [
			'timeout' => 25,
			'headers' => [ 'Authorization' => $api_key, 'Content-Type' => 'application/json; charset=utf-8' ],
			'body' => wp_json_encode( [ 'coordinates' => $clean, 'language' => 'it', 'instructions_format' => 'text' ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ),
		] );
		if ( is_wp_error( $response ) ) { wp_send_json_error( [ 'message' => $response->get_error_message() ], 500 ); }
		$code = wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );
		if ( $code < 200 || $code >= 300 || ! is_array( $data ) ) {
			$message = isset( $data['error']['message'] ) ? $data['error']['message'] : 'OpenRouteService non ha restituito un percorso valido.';
			wp_send_json_error( [ 'message' => $message ], $code ?: 500 );
		}
		wp_send_json_success( [ 'route' => $data ] );
	}

	public function allow_geojson_uploads( $mimes ) {
		$mimes['json'] = 'application/json';
		$mimes['geojson'] = 'application/geo+json';
		return $mimes;
	}

	public function admin_menu() {
		add_menu_page(
			'Wild Maps',
			'Wild Maps',
			'edit_posts',
			'wild-maps',
			[ $this, 'dashboard_page' ],
			'dashicons-location-alt',
			58
		);

		add_submenu_page(
			'wild-maps',
			'Dashboard',
			'Dashboard',
			'edit_posts',
			'wild-maps',
			[ $this, 'dashboard_page' ]
		);

		add_submenu_page(
			'wild-maps',
			'Projects',
			'Projects',
			'edit_posts',
			'wild-maps-projects',
			[ $this, 'map_points_page' ]
		);

		add_submenu_page(
			'wild-maps',
			'Manage Projects',
			'Manage Projects',
			'edit_posts',
			'edit.php?post_type=swm_map_project'
		);

		add_submenu_page(
			'wild-maps',
			'Roadbooks',
			'Roadbooks',
			'edit_posts',
			'wild-maps-roadbooks',
			[ $this, 'roadbooks_page' ]
		);

		add_submenu_page(
			'wild-maps',
			'Import / Export',
			'Import / Export',
			'edit_posts',
			'wild-maps-import-export',
			[ $this, 'import_export_page' ]
		);

		add_submenu_page(
			'wild-maps',
			'Settings',
			'Settings',
			'manage_options',
			'wild-maps-settings',
			[ $this, 'settings_page' ]
		);

		add_submenu_page(
			'wild-maps',
			'Help',
			'Help',
			'edit_posts',
			'wild-maps-help',
			[ $this, 'help_page' ]
		);
	}

	private function dashboard_counts() {
		return [
			'projects'  => (int) wp_count_posts( 'swm_map_project' )->publish,
			'poi'       => (int) wp_count_posts( 'swm_map_point' )->publish,
			'routes'    => count( get_posts( [ 'post_type' => 'swm_map_project', 'post_status' => 'publish', 'posts_per_page' => -1, 'meta_query' => [ [ 'key' => '_swm_route_geojson', 'compare' => 'EXISTS' ] ], 'fields' => 'ids' ] ) ),
			'roadbooks' => count( get_posts( [ 'post_type' => 'swm_map_project', 'post_status' => 'publish', 'posts_per_page' => -1, 'meta_query' => [ [ 'key' => '_swm_route_geojson', 'compare' => 'EXISTS' ] ], 'fields' => 'ids' ] ) ),
		];
	}

	public function dashboard_page() {
		if ( ! current_user_can( 'edit_posts' ) ) { return; }
		$counts = $this->dashboard_counts();
		$last = get_posts( [ 'post_type' => 'swm_map_project', 'post_status' => 'publish', 'posts_per_page' => 1, 'orderby' => 'modified', 'order' => 'DESC' ] );
		?>
		<div class="wrap swm-admin-page swm-dashboard">
			<div class="swm-hero">
				<div>
					<h1>Wild Maps <span>1.0.0</span></h1>
					<p class="swm-admin-lead">Professional Route & Roadbook Builder for WordPress.</p>
				</div>
				<a class="button button-primary button-hero" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=swm_map_project' ) ); ?>">+ New Project</a>
			</div>
			<div class="swm-dashboard-grid">
				<div class="swm-stat"><strong><?php echo esc_html( $counts['projects'] ); ?></strong><span>Projects</span></div>
				<div class="swm-stat"><strong><?php echo esc_html( $counts['routes'] ); ?></strong><span>Routes</span></div>
				<div class="swm-stat"><strong><?php echo esc_html( $counts['poi'] ); ?></strong><span>POI</span></div>
				<div class="swm-stat"><strong><?php echo esc_html( $counts['roadbooks'] ); ?></strong><span>Roadbooks</span></div>
			</div>
			<div class="swm-dashboard-actions">
				<a class="swm-action-card" href="<?php echo esc_url( admin_url( 'admin.php?page=wild-maps-projects' ) ); ?>"><strong>Open Project Studio</strong><span>Create routes, POI and roadbooks.</span></a>
				<a class="swm-action-card" href="<?php echo esc_url( admin_url( 'edit.php?post_type=swm_map_project' ) ); ?>"><strong>Manage Projects</strong><span>Edit project titles and archive old maps.</span></a>
				<a class="swm-action-card" href="<?php echo esc_url( admin_url( 'admin.php?page=wild-maps-import-export' ) ); ?>"><strong>Import / Export</strong><span>Prepared for .wmap, GPX, KML and CSV.</span></a>
				<a class="swm-action-card" href="<?php echo esc_url( admin_url( 'admin.php?page=wild-maps-settings' ) ); ?>"><strong>Settings</strong><span>OpenRouteService, MapTiler and Roadbook options.</span></a>
			</div>
			<?php if ( $last ) : ?>
				<p class="swm-last-project">Last project: <strong><?php echo esc_html( $last[0]->post_title ); ?></strong> · <a href="<?php echo esc_url( admin_url( 'admin.php?page=wild-maps-projects' ) ); ?>">open in Studio</a></p>
			<?php endif; ?>
		</div>
		<?php
	}

	public function roadbooks_page() { $this->placeholder_page( 'Roadbooks', 'Open a project in Project Studio and use the Roadbook tab to generate or print the roadbook.' ); }
	public function import_export_page() { $this->placeholder_page( 'Import / Export', 'This section is prepared for .wmap, GPX, KML and CSV workflows in the next sprint.' ); }
	public function help_page() { $this->placeholder_page( 'Help', 'Quick help, tooltips and documentation links will live here. For now, use Project Studio: Route = routing stops, POI = map points.' ); }

	private function placeholder_page( $title, $message ) {
		if ( ! current_user_can( 'edit_posts' ) ) { return; }
		?>
		<div class="wrap swm-admin-page">
			<h1><?php echo esc_html( $title ); ?></h1>
			<div class="swm-placeholder"><p><?php echo esc_html( $message ); ?></p><a class="button button-primary" href="<?php echo esc_url( admin_url( 'admin.php?page=wild-maps-projects' ) ); ?>">Open Project Studio</a></div>
		</div>
		<?php
	}

	public function admin_enqueue_scripts( $hook ) {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$is_swm_screen = false !== strpos( (string) $hook, 'wild-maps' ) || ( $screen && in_array( $screen->post_type, [ 'swm_map_point', 'swm_map_project' ], true ) );
		if ( ! $is_swm_screen ) { return; }

		// Media Library per scegliere icone POI senza copiare/incollare URL.
		wp_enqueue_media();

		// In admin, wp_enqueue_scripts does not run: register MapLibre here before enqueueing dependencies.
		$this->register_assets();

		wp_enqueue_style( 'swm-maplibre' );
		wp_enqueue_script( 'swm-maplibre' );
		wp_enqueue_style( 'swm-admin', SWM_URL . 'assets/css/admin.css', [ 'swm-maplibre' ], SWM_VERSION );
		wp_enqueue_script( 'swm-admin', SWM_URL . 'assets/js/admin.js', [ 'swm-maplibre' ], SWM_VERSION, true );
		wp_localize_script( 'swm-admin', 'SWM_ADMIN', [
			'ajaxUrl' => admin_url( 'admin-ajax.php' ),
			'nonce'   => wp_create_nonce( 'swm_admin_points' ),
			'center'  => [ 42.72, 43.04 ],
			'zoom'    => 7,
			'hasOrsKey' => (bool) self::openrouteservice_key(),
			'mapTilerKey' => self::maptiler_key(),
			'mapStyleUrl' => self::maptiler_key() ? add_query_arg( [ 'key' => self::maptiler_key(), 'language' => 'en' ], 'https://api.maptiler.com/maps/outdoor-v2/style.json' ) : '',
		] );
	}

	public function map_points_page() {
		if ( ! current_user_can( 'edit_posts' ) ) { return; }
		?>
		<div class="wrap swm-admin-page swm-studio-page">
			<div class="swm-studio-header">
				<div>
					<h1>Wild Maps Studio <span>1.0.0</span></h1>
					<p class="swm-admin-lead"><strong>Stops</strong> are used only to calculate the route. <strong>POI</strong> are independent points shown on the map and in the roadbook.</p>
				</div>
				<div class="swm-studio-topbar" aria-label="Project actions">
					<button class="button button-primary" data-swm-proxy="swm-route-save">Save</button>
					<button class="button" data-swm-proxy="swm-route-undo">Undo</button>
					<button class="button" disabled title="Redo will be available in the next sprint">Redo</button>
					<button class="button" data-swm-proxy="swm-route-calc">Calculate</button>
					<button class="button" data-swm-proxy="swm-route-pdf">Roadbook</button>
					<a class="button" href="<?php echo esc_url( home_url( '/' ) ); ?>" target="_blank" rel="noopener">Preview</a>
				</div>
			</div>

			<div class="swm-admin-project-card swm-project-switcher">
				<label for="swm-current-project"><strong>Project</strong></label>
				<select id="swm-current-project"><option value="">All / global POI</option><?php foreach ( self::get_map_projects_options() as $pid => $pname ) : if ( '' === $pid ) { continue; } ?><option value="<?php echo esc_attr( $pid ); ?>"><?php echo esc_html( $pname ); ?></option><?php endforeach; ?></select>
				<a class="button" href="<?php echo esc_url( admin_url( 'post-new.php?post_type=swm_map_project' ) ); ?>">+ New Project</a>
				<p class="description">Project POI and route stops are loaded only when this project is selected in the Elementor widget.</p>
			</div>

			<div class="swm-studio-tabs" role="tablist" aria-label="Wild Maps project sections">
				<button class="is-active" data-swm-tab="route" type="button">Route</button>
				<button data-swm-tab="poi" type="button">POI</button>
				<button data-swm-tab="roadbook" type="button">Roadbook</button>
				<button data-swm-tab="settings" type="button">Settings</button>
			</div>

			<div class="swm-studio-shell">
				<div class="swm-studio-toolbar" aria-label="Map tools">
					<button class="is-active" data-swm-tool="pan" title="Pan / move map" type="button">✋<span>Pan</span></button>
					<button data-swm-tool="route" data-swm-proxy="swm-route-mode" title="Add route stops" type="button">🛣<span>Route</span></button>
					<button data-swm-tool="poi" title="Add POI" type="button">📍<span>POI</span></button>
					<button data-swm-tool="edit" title="Edit selected item" type="button">✏<span>Edit</span></button>
					<button data-swm-tool="delete" data-swm-proxy="swm-map-delete-mode" title="Delete POI or stops" type="button">🗑<span>Delete</span></button>
					<button data-swm-tool="measure" disabled title="Measure tool will be available in a future sprint" type="button">📏<span>Measure</span></button>
				</div>

				<div class="swm-studio-main">
					<section class="swm-tab-panel is-active" data-swm-panel="route">
						<div class="swm-admin-search-card">
							<h2>Search place</h2>
							<p class="description">Search a place, then add it as a POI or as a route stop. Results prefer Latin/English names when available.</p>
							<div class="swm-admin-search-row">
								<input type="search" id="swm-place-search" class="regular-text" placeholder="Mestia, Ushguli, Kutaisi..." autocomplete="off" />
								<button class="button button-primary" id="swm-place-submit">Search</button>
								<button class="button" id="swm-place-clear">Clear</button>
							</div>
							<div id="swm-place-results" class="swm-place-results" aria-live="polite"></div>
						</div>

						<div class="swm-admin-route-card">
							<h2>Route Stops</h2>
							<p class="description">Route stops are used for OpenRouteService routing only. POI stay separate.</p>
							<div class="swm-admin-route-controls">
								<button class="button" id="swm-route-mode">Route mode: OFF</button>
								<select id="swm-route-profile">
									<option value="driving-car">Car / road</option>
									<option value="cycling-regular">Bike</option>
									<option value="foot-walking">Urban walking</option>
									<option value="foot-hiking">Hiking</option>
								</select>
								<button class="button" id="swm-route-calc">Calculate road route</button>
								<button class="button button-primary" id="swm-route-save">Save route</button>
								<button class="button" id="swm-route-undo">Delete last stop</button>
								<button class="button" id="swm-route-reverse">Reverse stops</button>
								<button class="button" id="swm-route-save-list">Save stop list</button>
								<button class="button button-link-delete" id="swm-route-clear">Clear route</button>
								<button class="button" id="swm-map-delete-mode">Delete mode: OFF</button>
							</div>
							<div id="swm-route-status"></div>
							<div class="swm-admin-route-list">
								<h3>Stops</h3>
								<ol id="swm-route-waypoints-list"></ol>
								<p class="description">Drag stops to reorder them. After reordering, recalculate and save the route.</p>
							</div>
						</div>
					</section>

					<section class="swm-tab-panel" data-swm-panel="poi">
						<div class="swm-admin-list-card">
							<h2>POI</h2>
							<p class="description">POI are independent points: mountains, cities, campsites, viewpoints, airports, villages and any marker that is not part of the route calculation.</p>
							<div id="swm-points-list"></div>
						</div>
					</section>

					<section class="swm-tab-panel" data-swm-panel="roadbook">
						<div class="swm-admin-route-card">
							<h2>Roadbook</h2>
							<p class="description">Generate the printable roadbook for the selected project. It uses the saved route, stops and project POI.</p>
							<button class="button button-primary" id="swm-route-pdf">Generate roadbook / PDF</button>
						</div>
					</section>

					<section class="swm-tab-panel" data-swm-panel="settings">
						<div class="swm-admin-route-card">
							<h2>Project Settings</h2>
							<p class="description">Global API keys and roadbook name preferences are available in Wild Maps → Settings. Project-specific styling will be added in the next UX sprint.</p>
							<a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=wild-maps-settings' ) ); ?>">Open Settings</a>
						</div>
					</section>

					<div class="swm-admin-layout swm-map-and-inspector">
						<div class="swm-admin-map-card">
							<div id="swm-admin-map"></div>
							<div class="swm-admin-hint">Map click = new POI. Route mode ON = map click adds a route stop. Delete mode = click POI or stop to remove it.</div>
						</div>

						<aside class="swm-admin-form-card swm-inspector">
							<h2 id="swm-form-title">New POI</h2>
							<input type="hidden" id="swm-point-id" value="" />
							<input type="hidden" id="swm-point-project-id" value="" />
							<label>Name</label>
							<input type="text" id="swm-point-name" class="regular-text" placeholder="Mestia" />
							<div class="swm-admin-grid-2">
								<p><label>Latitude</label><input type="text" id="swm-point-lat" placeholder="43.0334" /></p>
								<p><label>Longitude</label><input type="text" id="swm-point-lng" placeholder="42.6893" /></p>
							</div>
							<label>Category</label>
							<input type="text" id="swm-point-category" class="regular-text" placeholder="city, mountain, campsite..." />
							<label>Optional SVG/PNG icon</label>
							<div class="swm-media-field">
								<input type="url" id="swm-point-icon" class="large-text" placeholder="https://.../icon.svg" />
								<button type="button" class="button swm-select-media" data-target="swm-point-icon">Choose from library</button>
								<button type="button" class="button swm-clear-media" data-target="swm-point-icon">Remove icon</button>
							</div>
							<p class="description">If empty, the Elementor category icon is used first, then the backend default icon.</p>
							<label>Label</label>
							<select id="swm-point-label"><option value="1">Visible</option><option value="0">Hidden</option></select>
							<label>Popup description</label>
							<textarea id="swm-point-description" rows="4" class="large-text"></textarea>
							<label>Order</label>
							<input type="number" id="swm-point-order" class="small-text" value="0" />
							<div class="swm-admin-actions">
								<button class="button button-primary" id="swm-save-point">Save POI</button>
								<button class="button" id="swm-new-point">New</button>
								<button class="button button-link-delete" id="swm-delete-point" style="display:none;">Delete</button>
							</div>
							<div id="swm-admin-message" aria-live="polite"></div>
						</aside>
					</div>
				</div>
			</div>
			<div class="swm-studio-status"><span>OpenRouteService: <?php echo self::openrouteservice_key() ? '● Online' : '○ API key missing'; ?></span><span>Elementor: <?php echo did_action( 'elementor/loaded' ) ? '● Compatible' : '○ Not loaded'; ?></span><span>Last save: browser session</span></div>
		</div>
		<?php
	}

	private function map_point_array( $post ) {
		$lat = (float) str_replace( ',', '.', get_post_meta( $post->ID, '_swm_lat', true ) );
		$lng = (float) str_replace( ',', '.', get_post_meta( $post->ID, '_swm_lng', true ) );
		return [
			'id'          => (int) $post->ID,
			'name'        => get_the_title( $post ),
			'lat'         => $lat,
			'lng'         => $lng,
			'category'    => get_post_meta( $post->ID, '_swm_category', true ),
			'icon_url'    => get_post_meta( $post->ID, '_swm_icon_url', true ),
			'label'       => get_post_meta( $post->ID, '_swm_label', true ) === '0' ? '0' : '1',
			'description' => get_post_meta( $post->ID, '_swm_description', true ),
			'order'       => (int) get_post_meta( $post->ID, '_swm_order', true ),
			'project_id'  => (int) get_post_meta( $post->ID, '_swm_project_id', true ),
		];
	}

	private function get_all_map_points( $project_id = 0 ) {
		$args = [
			'post_type'      => 'swm_map_point',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'meta_key'       => '_swm_order',
			'orderby'        => [ 'meta_value_num' => 'ASC', 'title' => 'ASC' ],
			'order'          => 'ASC',
		];
		if ( $project_id ) {
			$args['meta_query'] = [ [ 'key' => '_swm_project_id', 'value' => $project_id, 'compare' => '=' ] ];
		}
		$query = new \WP_Query( $args );
		return array_map( [ $this, 'map_point_array' ], $query->posts );
	}

	public function ajax_list_points() {
		check_ajax_referer( 'swm_admin_points', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) { wp_send_json_error( [ 'message' => 'Permessi insufficienti.' ], 403 ); }
		$project_id = isset( $_POST['project_id'] ) ? absint( $_POST['project_id'] ) : 0;
		wp_send_json_success( [ 'points' => $this->get_all_map_points( $project_id ) ] );
	}

	public function ajax_save_point() {
		check_ajax_referer( 'swm_admin_points', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) { wp_send_json_error( [ 'message' => 'Permessi insufficienti.' ], 403 ); }

		$id   = isset( $_POST['id'] ) ? absint( $_POST['id'] ) : 0;
		$name = isset( $_POST['name'] ) ? sanitize_text_field( wp_unslash( $_POST['name'] ) ) : '';
		$lat  = isset( $_POST['lat'] ) ? sanitize_text_field( wp_unslash( $_POST['lat'] ) ) : '';
		$lng  = isset( $_POST['lng'] ) ? sanitize_text_field( wp_unslash( $_POST['lng'] ) ) : '';
		$project_id = isset( $_POST['project_id'] ) ? absint( $_POST['project_id'] ) : 0;

		if ( '' === $name || '' === $lat || '' === $lng ) {
			wp_send_json_error( [ 'message' => 'Nome, latitudine e longitudine sono obbligatori.' ], 400 );
		}

		$post_data = [
			'post_type'   => 'swm_map_point',
			'post_status' => 'publish',
			'post_title'  => $name,
		];
		if ( $id ) { $post_data['ID'] = $id; }

		$post_id = $id ? wp_update_post( $post_data, true ) : wp_insert_post( $post_data, true );
		if ( is_wp_error( $post_id ) ) { wp_send_json_error( [ 'message' => $post_id->get_error_message() ], 500 ); }

		$fields = [
			'lat'         => $lat,
			'lng'         => $lng,
			'category'    => isset( $_POST['category'] ) ? sanitize_text_field( wp_unslash( $_POST['category'] ) ) : '',
			'icon_url'    => isset( $_POST['icon_url'] ) ? esc_url_raw( wp_unslash( $_POST['icon_url'] ) ) : '',
			'label'       => ( isset( $_POST['label'] ) && '0' === $_POST['label'] ) ? '0' : '1',
			'description' => isset( $_POST['description'] ) ? sanitize_textarea_field( wp_unslash( $_POST['description'] ) ) : '',
			'order'       => isset( $_POST['order'] ) ? intval( $_POST['order'] ) : 0,
			'project_id'  => $project_id,
		];
		foreach ( $fields as $field => $value ) { update_post_meta( $post_id, '_swm_' . $field, $value ); }

		wp_send_json_success( [ 'point' => $this->map_point_array( get_post( $post_id ) ), 'points' => $this->get_all_map_points( $project_id ) ] );
	}

	public function ajax_delete_point() {
		check_ajax_referer( 'swm_admin_points', 'nonce' );
		if ( ! current_user_can( 'delete_posts' ) ) { wp_send_json_error( [ 'message' => 'Permessi insufficienti.' ], 403 ); }
		$id = isset( $_POST['id'] ) ? absint( $_POST['id'] ) : 0;
		if ( ! $id ) { wp_send_json_error( [ 'message' => 'Punto non valido.' ], 400 ); }
		wp_trash_post( $id );
		$project_id = isset( $_POST['project_id'] ) ? absint( $_POST['project_id'] ) : 0;
		wp_send_json_success( [ 'points' => $this->get_all_map_points( $project_id ) ] );
	}


	private function swm_format_distance( $meters ) {
		$meters = (float) $meters;
		if ( $meters >= 1000 ) { return number_format_i18n( $meters / 1000, 1 ) . ' km'; }
		return number_format_i18n( $meters, 0 ) . ' m';
	}

	private function swm_format_duration( $seconds ) {
		$seconds = (int) round( (float) $seconds );
		$hours = floor( $seconds / 3600 );
		$minutes = floor( ( $seconds % 3600 ) / 60 );
		if ( $hours > 0 ) { return $hours . ' h ' . $minutes . ' min'; }
		return max( 1, $minutes ) . ' min';
	}

	private function swm_fix_route_text( $text ) {
		$text = (string) $text;
		if ( '' === $text ) { return $text; }

		// Recupera sequenze Unicode rovinate tipo u10d0 oppure \u10d0.
		$text = preg_replace_callback( '/\\?u([0-9a-fA-F]{4})/', function( $match ) {
			$decoded = json_decode( '"\\u' . $match[1] . '"' );
			return is_string( $decoded ) ? $decoded : $match[0];
		}, $text );

		return trim( preg_replace( '/\s+/', ' ', $text ) );
	}

	private function swm_roadbook_direction_it( $direction ) {
		$direction = strtolower( trim( (string) $direction ) );
		$map = [
			'north' => 'nord', 'northeast' => 'nord-est', 'east' => 'est', 'southeast' => 'sud-est',
			'south' => 'sud', 'southwest' => 'sud-ovest', 'west' => 'ovest', 'northwest' => 'nord-ovest',
		];
		return $map[ $direction ] ?? $direction;
	}

	private function swm_cleanup_italian_instruction( $text ) {
		$text = preg_replace( '/\bGira\s+svolta\s+destra\b/iu', 'Svolta a destra', $text );
		$text = preg_replace( '/\bGira\s+svolta\s+sinistra\b/iu', 'Svolta a sinistra', $text );
		$text = preg_replace( '/\bGira\s+a\s+svolta\s+destra\b/iu', 'Svolta a destra', $text );
		$text = preg_replace( '/\bGira\s+a\s+svolta\s+sinistra\b/iu', 'Svolta a sinistra', $text );
		$text = preg_replace( '/\bAvanti\s+Est\b/iu', 'Procedi verso est', $text );
		$text = preg_replace( '/\bAvanti\s+Ovest\b/iu', 'Procedi verso ovest', $text );
		$text = preg_replace( '/\bAvanti\s+Nord\b/iu', 'Procedi verso nord', $text );
		$text = preg_replace( '/\bAvanti\s+Sud\b/iu', 'Procedi verso sud', $text );
		$text = str_replace( [ ' su su ', '  ' ], [ ' su ', ' ' ], $text );
		return trim( $text );
	}

	private function swm_contains_non_latin( $text ) {
		$text = (string) $text;
		return (bool) preg_match( '/[^\x00-\x7F]/u', $text );
	}

	private function swm_latinize_text( $text ) {
		$text = $this->swm_fix_route_text( $text );
		if ( '' === $text ) { return $text; }
		$map = [
			// Georgian Mkhedruli
			'ა'=>'a','ბ'=>'b','გ'=>'g','დ'=>'d','ე'=>'e','ვ'=>'v','ზ'=>'z','თ'=>'t','ი'=>'i','კ'=>'k','ლ'=>'l','მ'=>'m','ნ'=>'n','ო'=>'o','პ'=>'p','ჟ'=>'zh','რ'=>'r','ს'=>'s','ტ'=>'t','უ'=>'u','ფ'=>'p','ქ'=>'k','ღ'=>'gh','ყ'=>'q','შ'=>'sh','ჩ'=>'ch','ც'=>'ts','ძ'=>'dz','წ'=>'ts','ჭ'=>'ch','ხ'=>'kh','ჯ'=>'j','ჰ'=>'h','ჱ'=>'e','ჲ'=>'y','ჳ'=>'w','ჴ'=>'q','ჵ'=>'o','ჶ'=>'f','ჷ'=>'ə','ჸ'=>'ʔ','ჹ'=>'ə','ჺ'=>'ʔ','ჼ'=>'n','ჽ'=>'r','ჾ'=>'l','ჿ'=>'q',
			// Cyrillic, broad practical transliteration
			'А'=>'A','Б'=>'B','В'=>'V','Г'=>'G','Д'=>'D','Е'=>'E','Ё'=>'Yo','Ж'=>'Zh','З'=>'Z','И'=>'I','Й'=>'Y','К'=>'K','Л'=>'L','М'=>'M','Н'=>'N','О'=>'O','П'=>'P','Р'=>'R','С'=>'S','Т'=>'T','У'=>'U','Ф'=>'F','Х'=>'Kh','Ц'=>'Ts','Ч'=>'Ch','Ш'=>'Sh','Щ'=>'Shch','Ъ'=>'','Ы'=>'Y','Ь'=>'','Э'=>'E','Ю'=>'Yu','Я'=>'Ya','а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'yo','ж'=>'zh','з'=>'z','и'=>'i','й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ф'=>'f','х'=>'kh','ц'=>'ts','ч'=>'ch','ш'=>'sh','щ'=>'shch','ъ'=>'','ы'=>'y','ь'=>'','э'=>'e','ю'=>'yu','я'=>'ya','Є'=>'Ye','І'=>'I','Ї'=>'Yi','Ґ'=>'G','є'=>'ye','і'=>'i','ї'=>'yi','ґ'=>'g','Ў'=>'U','ў'=>'u','Қ'=>'Q','қ'=>'q','Ғ'=>'Gh','ғ'=>'gh','Ң'=>'Ng','ң'=>'ng','Ү'=>'U','ү'=>'u','Ұ'=>'U','ұ'=>'u','Ә'=>'A','ә'=>'a','Ө'=>'O','ө'=>'o','Һ'=>'H','һ'=>'h',
			// Greek, enough for road names
			'Α'=>'A','Β'=>'V','Γ'=>'G','Δ'=>'D','Ε'=>'E','Ζ'=>'Z','Η'=>'I','Θ'=>'Th','Ι'=>'I','Κ'=>'K','Λ'=>'L','Μ'=>'M','Ν'=>'N','Ξ'=>'X','Ο'=>'O','Π'=>'P','Ρ'=>'R','Σ'=>'S','Τ'=>'T','Υ'=>'Y','Φ'=>'F','Χ'=>'Ch','Ψ'=>'Ps','Ω'=>'O','α'=>'a','β'=>'v','γ'=>'g','δ'=>'d','ε'=>'e','ζ'=>'z','η'=>'i','θ'=>'th','ι'=>'i','κ'=>'k','λ'=>'l','μ'=>'m','ν'=>'n','ξ'=>'x','ο'=>'o','π'=>'p','ρ'=>'r','σ'=>'s','ς'=>'s','τ'=>'t','υ'=>'y','φ'=>'f','χ'=>'ch','ψ'=>'ps','ω'=>'o','Ά'=>'A','Έ'=>'E','Ή'=>'I','Ί'=>'I','Ό'=>'O','Ύ'=>'Y','Ώ'=>'O','ά'=>'a','έ'=>'e','ή'=>'i','ί'=>'i','ό'=>'o','ύ'=>'y','ώ'=>'o','ϊ'=>'i','ϋ'=>'y','ΐ'=>'i','ΰ'=>'y',
			// Armenian, practical transliteration
			'Ա'=>'A','Բ'=>'B','Գ'=>'G','Դ'=>'D','Ե'=>'Ye','Զ'=>'Z','Է'=>'E','Ը'=>'Y','Թ'=>'T','Ժ'=>'Zh','Ի'=>'I','Լ'=>'L','Խ'=>'Kh','Ծ'=>'Ts','Կ'=>'K','Հ'=>'H','Ձ'=>'Dz','Ղ'=>'Gh','Ճ'=>'Ch','Մ'=>'M','Յ'=>'Y','Ն'=>'N','Շ'=>'Sh','Ո'=>'Vo','Չ'=>'Ch','Պ'=>'P','Ջ'=>'J','Ռ'=>'R','Ս'=>'S','Վ'=>'V','Տ'=>'T','Ր'=>'R','Ց'=>'Ts','Ւ'=>'W','Փ'=>'P','Ք'=>'Q','Օ'=>'O','Ֆ'=>'F','ա'=>'a','բ'=>'b','գ'=>'g','դ'=>'d','ե'=>'e','զ'=>'z','է'=>'e','ը'=>'y','թ'=>'t','ժ'=>'zh','ի'=>'i','լ'=>'l','խ'=>'kh','ծ'=>'ts','կ'=>'k','հ'=>'h','ձ'=>'dz','ղ'=>'gh','ճ'=>'ch','մ'=>'m','յ'=>'y','ն'=>'n','շ'=>'sh','ո'=>'o','չ'=>'ch','պ'=>'p','ջ'=>'j','ռ'=>'r','ս'=>'s','վ'=>'v','տ'=>'t','ր'=>'r','ց'=>'ts','ւ'=>'w','փ'=>'p','ք'=>'q','օ'=>'o','ֆ'=>'f',
		];
		$text = strtr( $text, $map );
		if ( function_exists( 'transliterator_transliterate' ) ) {
			$icu = transliterator_transliterate( 'Any-Latin; Latin-ASCII', $text );
			if ( is_string( $icu ) && '' !== $icu ) { $text = $icu; }
		}
		return trim( preg_replace( '/\s+/', ' ', $text ) );
	}

	private function swm_best_latin_road_name_from_step( $step, $fallback_name ) {
		$fallback_name = trim( (string) $fallback_name );
		$mode = get_option( 'swm_roadbook_name_mode', 'latin' );
		if ( 'original' === $mode || '' === $fallback_name || ! $this->swm_contains_non_latin( $fallback_name ) ) { return $fallback_name; }

		if ( 'lookup_latin' === $mode && ! empty( $step['__swm_coord'] ) && is_array( $step['__swm_coord'] ) && count( $step['__swm_coord'] ) >= 2 ) {
			$lng = round( (float) $step['__swm_coord'][0], 5 );
			$lat = round( (float) $step['__swm_coord'][1], 5 );
			$cache_key = 'swm_road_name_' . md5( $lat . ',' . $lng . '|' . $fallback_name );
			$cached = get_transient( $cache_key );
			if ( is_string( $cached ) && '' !== $cached ) { return $cached; }

			$url = add_query_arg( [
				'format'          => 'jsonv2',
				'lat'             => $lat,
				'lon'             => $lng,
				'zoom'            => 18,
				'addressdetails'  => 1,
				'namedetails'     => 1,
				'accept-language' => 'it,en',
			], 'https://nominatim.openstreetmap.org/reverse' );
			$response = wp_remote_get( $url, [
				'timeout' => 8,
				'headers' => [ 'User-Agent' => 'WildMaps/' . SWM_VERSION . '; ' . home_url( '/' ), 'Accept' => 'application/json' ],
			] );
			if ( ! is_wp_error( $response ) && wp_remote_retrieve_response_code( $response ) >= 200 && wp_remote_retrieve_response_code( $response ) < 300 ) {
				$data = json_decode( wp_remote_retrieve_body( $response ), true );
				if ( is_array( $data ) ) {
					$namedetails = isset( $data['namedetails'] ) && is_array( $data['namedetails'] ) ? $data['namedetails'] : [];
					$address = isset( $data['address'] ) && is_array( $data['address'] ) ? $data['address'] : [];
					$candidates = [
						$namedetails['name:it'] ?? '', $namedetails['name:en'] ?? '', $namedetails['int_name'] ?? '', $namedetails['official_name:en'] ?? '', $namedetails['official_name'] ?? '', $namedetails['alt_name:en'] ?? '',
						$address['road'] ?? '', $data['name'] ?? '',
					];
					foreach ( $candidates as $candidate ) {
						$candidate = trim( (string) $candidate );
						if ( '' !== $candidate && ! $this->swm_contains_non_latin( $candidate ) ) {
							set_transient( $cache_key, $candidate, WEEK_IN_SECONDS );
							return $candidate;
						}
					}
				}
			}
		}

		return $this->swm_latinize_text( $fallback_name );
	}


	private function swm_road_name_is_messy( $road ) {
		$road = trim( (string) $road );
		if ( '' === $road ) { return true; }
		// Se resta testo non latino o la traslitterazione contiene codici/toni numerici, meglio non stamparla.
		if ( $this->swm_contains_non_latin( $road ) ) { return true; }
		if ( preg_match( '/[a-z]\d|\d[a-z]/i', $road ) && strlen( $road ) > 8 ) { return true; }
		if ( preg_match( '/\bu[0-9a-f]{4}\b/i', $road ) ) { return true; }
		// Lunghe sequenze senza parole leggibili: tipiche di traslitterazioni automatiche poco utili.
		$letters = preg_replace( '/[^a-zA-Z]/', '', $road );
		if ( strlen( $road ) > 48 && substr_count( $road, ' ' ) < 2 && strlen( $letters ) > 24 ) { return true; }
		return false;
	}

	private function swm_prepare_roadbook_instruction( $instruction, $step = [] ) {
		$text = $this->swm_translate_instruction_it( $instruction );
		$mode = get_option( 'swm_roadbook_name_mode', 'latin' );
		if ( 'original' === $mode ) { return $text; }

		// Sostituisce soprattutto la parte dopo "su", lasciando pulita la manovra in italiano.
		if ( preg_match( '/^(.*\ssu\s)(.+)$/u', $text, $m ) ) {
			$road = trim( $m[2] );
			// Lascia eventuali note finali italiane fuori dal nome strada.
			$suffix = '';
			if ( preg_match( '/^(.*?)(,\s*(?:sulla destra|sulla sinistra))$/u', $road, $sm ) ) {
				$road = trim( $sm[1] );
				$suffix = $sm[2];
			}
			$road = $this->swm_best_latin_road_name_from_step( $step, $road );
			if ( $this->swm_road_name_is_messy( $road ) ) {
				$base = preg_replace( '/\s+su\s*$/u', '', $m[1] );
				return trim( $base . $suffix );
			}
			return trim( $m[1] . $road . $suffix );
		}

		return $this->swm_latinize_text( $text );
	}

	private function swm_translate_instruction_it( $instruction ) {
		$text = $this->swm_fix_route_text( $instruction );
		if ( '' === $text ) { return 'Prosegui'; }

		// Se OpenRouteService ha già restituito italiano, lasciamo quasi tutto invariato.
		$italian_markers = [ 'svolta', 'continua', 'procedi', 'mantieni', 'entra', 'prendi', 'arrivo', 'rotatoria' ];
		$lower = function_exists( 'mb_strtolower' ) ? mb_strtolower( $text, 'UTF-8' ) : strtolower( $text );
		foreach ( $italian_markers as $marker ) {
			if ( false !== strpos( $lower, $marker ) ) { return $this->swm_cleanup_italian_instruction( $text ); }
		}

		$replacements = [
			'/^Turn slight right onto\s+/i' => 'Svolta leggermente a destra su ',
			'/^Turn slight left onto\s+/i' => 'Svolta leggermente a sinistra su ',
			'/^Turn sharp right onto\s+/i' => 'Svolta stretta a destra su ',
			'/^Turn sharp left onto\s+/i' => 'Svolta stretta a sinistra su ',
			'/^Turn right onto\s+/i' => 'Svolta a destra su ',
			'/^Turn left onto\s+/i' => 'Svolta a sinistra su ',
			'/^Turn right$/i' => 'Svolta a destra',
			'/^Turn left$/i' => 'Svolta a sinistra',
			'/^Keep right onto\s+/i' => 'Mantieni la destra su ',
			'/^Keep left onto\s+/i' => 'Mantieni la sinistra su ',
			'/^Keep right$/i' => 'Mantieni la destra',
			'/^Keep left$/i' => 'Mantieni la sinistra',
			'/^Continue straight onto\s+/i' => 'Continua dritto su ',
			'/^Continue straight$/i' => 'Continua dritto',
			'/^Arrive at\s+/i' => 'Arrivo a ',
			'/, on the right$/i' => ', sulla destra',
			'/, on the left$/i' => ', sulla sinistra',
		];
		foreach ( $replacements as $pattern => $replace ) {
			$text = preg_replace( $pattern, $replace, $text );
		}

		$text = preg_replace_callback( '/^Head\s+(north|northeast|east|southeast|south|southwest|west|northwest)(?:\s+on\s+|\s+)/i', function( $m ) {
			return 'Procedi verso ' . $this->swm_roadbook_direction_it( $m[1] ) . ( false !== stripos( $m[0], ' on ' ) ? ' su ' : ' ' );
		}, $text );

		$text = preg_replace_callback( '/^Enter the roundabout and take the ([0-9]+)(?:st|nd|rd|th) exit onto\s+/i', function( $m ) {
			return 'Entra nella rotatoria e prendi la ' . intval( $m[1] ) . 'ª uscita su ';
		}, $text );
		$text = preg_replace_callback( '/^Enter the roundabout and take the ([0-9]+)(?:st|nd|rd|th) exit$/i', function( $m ) {
			return 'Entra nella rotatoria e prendi la ' . intval( $m[1] ) . 'ª uscita';
		}, $text );

		// Piccoli residui inglesi frequenti.
		$text = str_ireplace( [ ' onto ', ' on ' ], [ ' su ', ' su ' ], $text );
		return $this->swm_cleanup_italian_instruction( $text );
	}

	private function swm_format_progressive_km( $meters ) {
		return number_format_i18n( max( 0, (float) $meters ) / 1000, 1 ) . ' km';
	}

	private function swm_route_features( $geojson ) {
		if ( ! is_array( $geojson ) ) { return []; }
		if ( isset( $geojson['type'] ) && 'FeatureCollection' === $geojson['type'] && ! empty( $geojson['features'] ) && is_array( $geojson['features'] ) ) { return $geojson['features']; }
		if ( isset( $geojson['type'] ) && 'Feature' === $geojson['type'] ) { return [ $geojson ]; }
		return [];
	}


	private function swm_roadbook_icon( $instruction ) {
		$text = mb_strtolower( (string) $instruction );
		if ( false !== mb_stripos( $text, 'arriv' ) ) { return '🏁'; }
		if ( false !== mb_stripos( $text, 'partenza' ) || false !== mb_stripos( $text, 'procedi verso' ) ) { return '⬆'; }
		if ( false !== mb_stripos( $text, 'rotatoria' ) ) { return '⟳'; }
		if ( false !== mb_stripos( $text, 'destra' ) ) { return '↱'; }
		if ( false !== mb_stripos( $text, 'sinistra' ) ) { return '↰'; }
		if ( false !== mb_stripos( $text, 'mantieni' ) ) { return '⇢'; }
		if ( false !== mb_stripos( $text, 'continua' ) || false !== mb_stripos( $text, 'prosegui' ) ) { return '↑'; }
		return '•';
	}

	private function swm_collect_route_coordinates( $geojson ) {
		$out = [];
		$scan_geom = function( $geom ) use ( &$scan_geom, &$out ) {
			if ( ! is_array( $geom ) || empty( $geom['type'] ) ) { return; }
			if ( 'LineString' === $geom['type'] && ! empty( $geom['coordinates'] ) && is_array( $geom['coordinates'] ) ) {
				foreach ( $geom['coordinates'] as $c ) { if ( is_array( $c ) && count( $c ) >= 2 ) { $out[] = [ (float) $c[0], (float) $c[1] ]; } }
			} elseif ( 'MultiLineString' === $geom['type'] && ! empty( $geom['coordinates'] ) && is_array( $geom['coordinates'] ) ) {
				foreach ( $geom['coordinates'] as $line ) { foreach ( (array) $line as $c ) { if ( is_array( $c ) && count( $c ) >= 2 ) { $out[] = [ (float) $c[0], (float) $c[1] ]; } } }
			} elseif ( 'GeometryCollection' === $geom['type'] && ! empty( $geom['geometries'] ) && is_array( $geom['geometries'] ) ) {
				foreach ( $geom['geometries'] as $g ) { $scan_geom( $g ); }
			}
		};
		if ( is_array( $geojson ) ) {
			if ( isset( $geojson['type'] ) && 'FeatureCollection' === $geojson['type'] && ! empty( $geojson['features'] ) ) {
				foreach ( $geojson['features'] as $feature ) { $scan_geom( $feature['geometry'] ?? [] ); }
			} elseif ( isset( $geojson['type'] ) && 'Feature' === $geojson['type'] ) {
				$scan_geom( $geojson['geometry'] ?? [] );
			} else { $scan_geom( $geojson ); }
		}
		return $out;
	}

	private function swm_route_svg_overview( $coords, $waypoints = [], $points = [] ) {
		if ( empty( $coords ) ) { return ''; }
		$all = $coords;
		foreach ( (array) $waypoints as $wp ) { if ( is_array( $wp ) && count( $wp ) >= 2 ) { $all[] = [ (float) $wp[0], (float) $wp[1] ]; } }
		foreach ( (array) $points as $pt ) { if ( ! empty( $pt['lat'] ) && ! empty( $pt['lng'] ) ) { $all[] = [ (float) $pt['lng'], (float) $pt['lat'] ]; } }
		$lngs = array_column( $all, 0 );
		$lats = array_column( $all, 1 );
		$min_lng = min( $lngs ); $max_lng = max( $lngs ); $min_lat = min( $lats ); $max_lat = max( $lats );
		if ( $max_lng === $min_lng ) { $max_lng += 0.01; $min_lng -= 0.01; }
		if ( $max_lat === $min_lat ) { $max_lat += 0.01; $min_lat -= 0.01; }
		$w = 920; $h = 300; $pad = 26;
		$project = function( $lng, $lat ) use ( $min_lng, $max_lng, $min_lat, $max_lat, $w, $h, $pad ) {
			$x = $pad + ( ( $lng - $min_lng ) / ( $max_lng - $min_lng ) ) * ( $w - $pad * 2 );
			$y = $h - $pad - ( ( $lat - $min_lat ) / ( $max_lat - $min_lat ) ) * ( $h - $pad * 2 );
			return [ round( $x, 1 ), round( $y, 1 ) ];
		};
		$pts = [];
		$step = max( 1, (int) floor( count( $coords ) / 700 ) );
		foreach ( $coords as $i => $c ) { if ( 0 === $i % $step ) { $p = $project( $c[0], $c[1] ); $pts[] = $p[0] . ',' . $p[1]; } }
		$svg = '<svg viewBox="0 0 ' . $w . ' ' . $h . '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mappa riepilogativa percorso">';
		$svg .= '<rect width="100%" height="100%" rx="16" fill="#f4f1ea"/>';
		$svg .= '<path d="M0 260 C 160 210, 260 280, 410 225 S 705 185, 920 240" fill="none" stroke="#e1d8c7" stroke-width="22" opacity=".75"/>';
		$svg .= '<polyline points="' . esc_attr( implode( ' ', $pts ) ) . '" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
		foreach ( (array) $points as $pt ) { if ( empty( $pt['lat'] ) || empty( $pt['lng'] ) ) { continue; } $p = $project( (float) $pt['lng'], (float) $pt['lat'] ); $svg .= '<circle cx="' . $p[0] . '" cy="' . $p[1] . '" r="4" fill="#777"/>'; }
		foreach ( (array) $waypoints as $i => $wp ) { if ( ! is_array( $wp ) || count( $wp ) < 2 ) { continue; } $p = $project( (float) $wp[0], (float) $wp[1] ); $svg .= '<circle cx="' . $p[0] . '" cy="' . $p[1] . '" r="11" fill="#111"/><text x="' . $p[0] . '" y="' . ( $p[1] + 4 ) . '" text-anchor="middle" font-family="Arial" font-size="11" font-weight="700" fill="#fff">' . ( $i + 1 ) . '</text>'; }
		$svg .= '</svg>';
		return $svg;
	}

	private function swm_waypoint_label( $wp, $index, $project_points = [] ) {
		$lng = is_array( $wp ) && isset( $wp[0] ) ? (float) $wp[0] : 0;
		$lat = is_array( $wp ) && isset( $wp[1] ) ? (float) $wp[1] : 0;
		$best = null; $best_dist = 999999;
		foreach ( (array) $project_points as $pt ) {
			if ( empty( $pt['lat'] ) || empty( $pt['lng'] ) || empty( $pt['name'] ) ) { continue; }
			$d = abs( (float) $pt['lat'] - $lat ) + abs( (float) $pt['lng'] - $lng );
			if ( $d < $best_dist ) { $best_dist = $d; $best = $pt; }
		}
		if ( is_array( $wp ) && ! empty( $wp[2] ) ) { return sanitize_text_field( (string) $wp[2] ); }
		if ( $best && $best_dist < 0.03 ) { return $best['name']; }
		return 'Tappa ' . ( (int) $index + 1 );
	}


	public function admin_route_pdf() {
		if ( ! current_user_can( 'edit_posts' ) ) { wp_die( 'Permessi insufficienti.' ); }
		$nonce = isset( $_GET['nonce'] ) ? sanitize_text_field( wp_unslash( $_GET['nonce'] ) ) : '';
		if ( ! wp_verify_nonce( $nonce, 'swm_admin_points' ) ) { wp_die( 'Nonce non valido.' ); }
		$project_id = isset( $_GET['project_id'] ) ? absint( $_GET['project_id'] ) : 0;
		if ( ! $project_id ) { wp_die( 'Seleziona un progetto mappa.' ); }

		$project = get_post( $project_id );
		$title = $project ? get_the_title( $project ) : 'Percorso';
		$route_raw = get_post_meta( $project_id, '_swm_route_geojson', true );
		$route = $route_raw ? json_decode( $route_raw, true ) : null;
		$waypoints_raw = get_post_meta( $project_id, '_swm_route_waypoints', true );
		$waypoints = $waypoints_raw ? json_decode( $waypoints_raw, true ) : [];
		$project_points = $this->get_all_map_points( $project_id );
		$features = $this->swm_route_features( $route );
		if ( empty( $features ) ) { wp_die( 'Nessun percorso salvato per questo progetto. Calcola e salva prima il percorso.' ); }

		$total_distance = 0;
		$total_duration = 0;
		$steps = [];
		foreach ( $features as $feature ) {
			$props = isset( $feature['properties'] ) && is_array( $feature['properties'] ) ? $feature['properties'] : [];
			if ( isset( $props['summary']['distance'] ) ) { $total_distance += (float) $props['summary']['distance']; }
			if ( isset( $props['summary']['duration'] ) ) { $total_duration += (float) $props['summary']['duration']; }
			$geometry_coords = isset( $feature['geometry']['coordinates'] ) && is_array( $feature['geometry']['coordinates'] ) ? $feature['geometry']['coordinates'] : [];
			if ( ! empty( $props['segments'] ) && is_array( $props['segments'] ) ) {
				foreach ( $props['segments'] as $segment ) {
					if ( ! empty( $segment['steps'] ) && is_array( $segment['steps'] ) ) {
						foreach ( $segment['steps'] as $step ) {
							if ( isset( $step['way_points'][0] ) && isset( $geometry_coords[ (int) $step['way_points'][0] ] ) ) {
								$step['__swm_coord'] = $geometry_coords[ (int) $step['way_points'][0] ];
							}
							$steps[] = $step;
						}
					}
				}
			}
		}
		$route_coords = $this->swm_collect_route_coordinates( $route );
		$overview_svg = $this->swm_route_svg_overview( $route_coords, $waypoints, $project_points );
		$map_style_url = self::maptiler_key() ? add_query_arg( [ 'key' => self::maptiler_key(), 'language' => 'en' ], 'https://api.maptiler.com/maps/outdoor-v2/style.json' ) : '';
		$roadbook_map_data = [
			'route' => $route,
			'route_coords' => $route_coords,
			'waypoints' => is_array( $waypoints ) ? $waypoints : [],
			'points' => is_array( $project_points ) ? $project_points : [],
			'style_url' => $map_style_url,
		];
		$created = date_i18n( 'd/m/Y' );
		?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<title><?php echo esc_html( $title ); ?> - Roadbook Wild Maps</title>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.7.1/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@5.7.1/dist/maplibre-gl.js"></script>
<style>
:root{--ink:#111;--muted:#666;--line:#ddd;--paper:#fff;--cream:#f4f1ea}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:var(--ink);background:#f1f1f1}.swm-pdf{max-width:1080px;margin:24px auto;background:var(--paper);padding:34px 40px;box-shadow:0 12px 38px rgba(0,0,0,.13)}.actions{position:sticky;top:0;background:#fff;padding:12px 0;margin:-12px 0 18px;border-bottom:1px solid #eee;z-index:5}.button{display:inline-block;border:1px solid #111;border-radius:4px;background:#111;color:#fff;padding:10px 15px;text-decoration:none;cursor:pointer}.cover{border:2px solid #111;border-radius:22px;padding:26px;margin-bottom:28px;background:linear-gradient(180deg,#fff,#faf8f3)}.brand{font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;margin-bottom:18px}.title-row{display:flex;justify-content:space-between;gap:22px;align-items:flex-start}.title-row h1{font-size:38px;line-height:1.05;margin:0}.date{color:var(--muted);white-space:nowrap}.overview{margin:22px 0 18px}.overview svg,.overview img{width:100%;height:auto;display:block;border-radius:16px}.swm-roadbook-live-map{width:100%;height:320px;border:1px solid #ddd;background:#f4f1ea;border-radius:16px;overflow:hidden}.swm-roadbook-map-fallback{display:none}.swm-roadbook-live-map .maplibregl-control-container{display:none}.swm-roadbook-map{border:1px solid #ddd;background:#f4f1ea}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}.pill{border:1px solid #d8d8d8;border-radius:16px;padding:13px 14px;background:#fff}.pill strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:5px}.pill span{font-size:20px;font-weight:800}h2{font-size:24px;margin:30px 0 10px;border-bottom:2px solid #111;padding-bottom:8px}.waypoints{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 18px;margin:12px 0 0;padding:0;list-style:none}.waypoints li{border-bottom:1px solid #eee;padding:8px 0}.waypoints .wp-title{font-weight:700}.waypoints .wp-coords{display:block;color:#666;font-size:12px;margin-left:34px;margin-top:2px}.waypoints .num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:99px;background:#111;color:#fff;font-weight:700;font-size:12px;margin-right:8px}.roadbook{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;table-layout:fixed}.roadbook thead{display:table-header-group}.roadbook th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;text-align:left;color:#555;border-bottom:2px solid #111;padding:8px 7px}.roadbook td{border-bottom:1px solid #e8e8e8;padding:8px 7px;vertical-align:top}.roadbook tr:nth-child(even) td{background:#fbfbfb}.roadbook .km{width:90px;white-space:nowrap;font-weight:800}.roadbook .icon{width:38px;text-align:center;font-size:18px}.roadbook .instruction{width:auto}.roadbook .dist{width:118px;white-space:nowrap;text-align:right;color:#333}.roadbook .time{width:80px;white-space:nowrap;text-align:right;color:#333}.roadbook th.dist,.roadbook th.time{text-align:right}.poi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px 18px}.poi{border:1px solid #e3e3e3;border-radius:12px;padding:10px;background:#fff}.poi strong{display:block}.poi small{color:#666}.note{color:#555;font-size:13px;margin-top:24px;border-top:1px solid #ddd;padding-top:12px}.page-break{break-before:page;page-break-before:always}@media print{body{background:#fff}.swm-pdf{box-shadow:none;margin:0;max-width:none;padding:18mm}.actions{display:none}.cover{break-inside:avoid;page-break-inside:avoid}.roadbook td{page-break-inside:avoid}.meta{grid-template-columns:repeat(4,1fr)}a{color:#111;text-decoration:none}}
</style>
</head>
<body>
<div class="swm-pdf">
	<div class="actions"><button class="button" onclick="window.print()">Stampa / Salva PDF</button></div>
	<section class="cover">
		<div class="brand">Wild Maps Roadbook</div>
		<div class="title-row">
			<h1><?php echo esc_html( $title ); ?></h1>
			<div class="date">Generato il <?php echo esc_html( $created ); ?></div>
		</div>
		<div class="overview swm-real-map-wrap">
			<div id="swm-roadbook-live-map" class="swm-roadbook-live-map" aria-label="Mappa reale del percorso"></div>
			<?php if ( $overview_svg ) : ?><div id="swm-roadbook-map-fallback" class="swm-roadbook-map-fallback"><?php echo $overview_svg; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></div><?php endif; ?>
		</div>
		<div class="meta">
			<div class="pill"><strong>Distanza</strong><span><?php echo esc_html( $this->swm_format_distance( $total_distance ) ); ?></span></div>
			<div class="pill"><strong>Tempo stimato</strong><span><?php echo esc_html( $this->swm_format_duration( $total_duration ) ); ?></span></div>
			<div class="pill"><strong>Tappe</strong><span><?php echo esc_html( is_array( $waypoints ) ? count( $waypoints ) : 0 ); ?></span></div>
			<div class="pill"><strong>POI</strong><span><?php echo esc_html( is_array( $project_points ) ? count( $project_points ) : 0 ); ?></span></div>
		</div>
	</section>

	<h2>Tappe</h2>
	<ol class="waypoints">
	<?php if ( is_array( $waypoints ) ) : foreach ( $waypoints as $i => $wp ) : ?>
		<li><span class="num"><?php echo esc_html( $i + 1 ); ?></span><span class="wp-title"><?php echo esc_html( $this->swm_waypoint_label( $wp, $i, $project_points ) ); ?></span><?php if ( is_array( $wp ) && isset( $wp[0], $wp[1] ) ) : ?><span class="wp-coords"><?php echo esc_html( number_format_i18n( (float) $wp[1], 5 ) . ', ' . number_format_i18n( (float) $wp[0], 5 ) ); ?></span><?php endif; ?></li>
	<?php endforeach; endif; ?>
	</ol>

	<h2>Roadbook</h2>
	<table class="roadbook">
		<colgroup><col style="width:90px"><col style="width:38px"><col><col style="width:118px"><col style="width:80px"></colgroup>
		<thead><tr><th>Km</th><th></th><th>Istruzione</th><th class="dist">Distanza</th><th class="time">Tempo</th></tr></thead>
		<tbody>
	<?php $progressive = 0; foreach ( $steps as $step ) :
		$instruction = isset( $step['instruction'] ) ? $this->swm_prepare_roadbook_instruction( $step['instruction'], $step ) : 'Prosegui';
		$step_distance_raw = isset( $step['distance'] ) ? (float) $step['distance'] : 0;
		$distance = $step_distance_raw ? $this->swm_format_distance( $step_distance_raw ) : '';
		$duration = isset( $step['duration'] ) ? $this->swm_format_duration( $step['duration'] ) : '';
		?>
		<tr>
			<td class="km"><?php echo esc_html( $this->swm_format_progressive_km( $progressive ) ); ?></td>
			<td class="icon"><?php echo esc_html( $this->swm_roadbook_icon( $instruction ) ); ?></td>
			<td class="instruction"><?php echo esc_html( $instruction ); ?></td>
			<td class="dist"><?php echo esc_html( $distance ); ?></td>
			<td class="time"><?php echo esc_html( $duration ); ?></td>
		</tr>
	<?php $progressive += $step_distance_raw; endforeach; ?>
		</tbody>
	</table>

	<?php if ( ! empty( $project_points ) ) : ?>
	<h2>POI del progetto</h2>
	<div class="poi-grid">
	<?php foreach ( $project_points as $pt ) : ?>
		<div class="poi"><strong><?php echo esc_html( $pt['name'] ); ?></strong><small><?php echo esc_html( $pt['category'] ? $pt['category'] . ' · ' : '' ); ?><?php echo esc_html( number_format_i18n( $pt['lat'], 5 ) . ', ' . number_format_i18n( $pt['lng'], 5 ) ); ?></small><?php if ( ! empty( $pt['description'] ) ) : ?><p><?php echo esc_html( $pt['description'] ); ?></p><?php endif; ?></div>
	<?php endforeach; ?>
	</div>
	<?php endif; ?>

	<p class="note">Roadbook generato da Wild Maps con OpenRouteService. Controlla sempre strade, piste, permessi, chiusure stagionali e condizioni locali prima della partenza. I tempi sono indicativi e possono variare molto su sterrati, passi, guadi o tratti remoti.</p>
</div>
<script id="swm-roadbook-data" type="application/json"><?php echo wp_json_encode( $roadbook_map_data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></script>
<script>
(function(){
	function showFallback(){ var m=document.getElementById('swm-roadbook-live-map'); var f=document.getElementById('swm-roadbook-map-fallback'); if(m) m.style.display='none'; if(f) f.style.display='block'; }
	function collectCoords(geojson, out){
		out = out || [];
		function scanGeom(g){ if(!g||!g.type) return; if(g.type==='LineString'){ (g.coordinates||[]).forEach(function(c){ if(c&&c.length>=2) out.push([Number(c[0]),Number(c[1])]); }); } else if(g.type==='MultiLineString'){ (g.coordinates||[]).forEach(function(line){ (line||[]).forEach(function(c){ if(c&&c.length>=2) out.push([Number(c[0]),Number(c[1])]); }); }); } }
		if(geojson&&geojson.type==='FeatureCollection') (geojson.features||[]).forEach(function(f){ scanGeom(f.geometry); }); else if(geojson&&geojson.type==='Feature') scanGeom(geojson.geometry); else scanGeom(geojson);
		return out;
	}
	try{
		if(!window.maplibregl){ showFallback(); return; }
		var raw=document.getElementById('swm-roadbook-data');
		var data=raw ? JSON.parse(raw.textContent||'{}') : {};
		var route=data.route||null;
		var coords=collectCoords(route, []);
		if(!coords.length){ showFallback(); return; }
		var style=data.style_url || { version:8, sources:{ osm:{ type:'raster', tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize:256, attribution:'© OpenStreetMap' } }, layers:[{ id:'osm', type:'raster', source:'osm' }] };
		var map=new maplibregl.Map({ container:'swm-roadbook-live-map', style:style, interactive:false, attributionControl:false, preserveDrawingBuffer:true });
		map.on('load', function(){
			map.addSource('swm-roadbook-route', { type:'geojson', data: route });
			map.addLayer({ id:'swm-roadbook-route-case', type:'line', source:'swm-roadbook-route', paint:{ 'line-color':'#ffffff', 'line-width':7, 'line-opacity':0.95 } });
			map.addLayer({ id:'swm-roadbook-route-line', type:'line', source:'swm-roadbook-route', paint:{ 'line-color':'#111111', 'line-width':4.5, 'line-opacity':0.98 } });
			var b=new maplibregl.LngLatBounds(coords[0], coords[0]); coords.forEach(function(c){ b.extend(c); });
			map.fitBounds(b, { padding:45, duration:0 });
			(data.waypoints||[]).forEach(function(wp,i){ if(!wp||wp.length<2) return; var el=document.createElement('div'); el.style.cssText='width:24px;height:24px;border-radius:50%;background:#111;color:#fff;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:bold 12px Arial'; el.textContent=String(i+1); new maplibregl.Marker({element:el}).setLngLat([Number(wp[0]),Number(wp[1])]).addTo(map); });
		});
	}catch(e){ showFallback(); }
})();
</script>
</body>
</html><?php
		exit;
	}



	public function register_settings() {
		register_setting( 'staywild_maps_settings', 'swm_maptiler_api_key', [
			'type' => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default' => '',
		] );
		register_setting( 'staywild_maps_settings', 'swm_openrouteservice_api_key', [
			'type' => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default' => '',
		] );
		register_setting( 'staywild_maps_settings', 'swm_roadbook_name_mode', [
			'type' => 'string',
			'sanitize_callback' => function( $value ) {
				$value = sanitize_key( $value );
				return in_array( $value, [ 'original', 'latin', 'lookup_latin' ], true ) ? $value : 'latin';
			},
			'default' => 'latin',
		] );
	}

	public function settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) { return; }
		?>
		<div class="wrap">
			<h1>Wild Maps</h1>
			<form method="post" action="options.php">
				<?php settings_fields( 'staywild_maps_settings' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="swm_maptiler_api_key">MapTiler API Key</label></th>
						<td>
							<input type="text" id="swm_maptiler_api_key" name="swm_maptiler_api_key" value="<?php echo esc_attr( get_option( 'swm_maptiler_api_key', '' ) ); ?>" class="regular-text" />
							<p class="description">Inserisci qui la chiave MapTiler. Il widget Elementor la userà automaticamente.</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="swm_openrouteservice_api_key">OpenRouteService API Key</label></th>
						<td>
							<input type="text" id="swm_openrouteservice_api_key" name="swm_openrouteservice_api_key" value="<?php echo esc_attr( get_option( 'swm_openrouteservice_api_key', '' ) ); ?>" class="regular-text" />
							<p class="description">Serve per creare percorsi agganciati alle strade dal backend. Il caricamento GeoJSON resta indipendente.</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="swm_roadbook_name_mode">Nomi strade nel Roadbook</label></th>
						<td>
							<?php $roadbook_mode = get_option( 'swm_roadbook_name_mode', 'latin' ); ?>
							<select id="swm_roadbook_name_mode" name="swm_roadbook_name_mode">
								<option value="latin" <?php selected( $roadbook_mode, 'latin' ); ?>>Preferisci caratteri latini / traslitterazione</option>
								<option value="lookup_latin" <?php selected( $roadbook_mode, 'lookup_latin' ); ?>>Cerca nomi internazionali + traslitterazione</option>
								<option value="original" <?php selected( $roadbook_mode, 'original' ); ?>>Mantieni nomi originali</option>
							</select>
							<p class="description">Per Georgia, Giappone, Mongolia, Balcani/Caucaso e altri alfabeti locali. "Cerca nomi internazionali" prova anche OpenStreetMap/Nominatim e può rallentare un po' la generazione del roadbook.</p>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}

	public function register_assets() {
		wp_register_style( 'swm-maplibre', 'https://unpkg.com/maplibre-gl@5.7.1/dist/maplibre-gl.css', [], '5.7.1' );
		wp_register_script( 'swm-maplibre', 'https://unpkg.com/maplibre-gl@5.7.1/dist/maplibre-gl.js', [], '5.7.1', true );
		wp_register_style( 'swm-frontend', SWM_URL . 'assets/css/style.css', [], SWM_VERSION );
		wp_register_script( 'swm-frontend', SWM_URL . 'assets/js/frontend.js', [ 'swm-maplibre' ], SWM_VERSION, true );
	}

	public function register_elementor_category( $elements_manager ) {
		$elements_manager->add_category( 'staywild', [ 'title' => 'Wild Maps', 'icon' => 'fa fa-map' ] );
	}

	public function register_widgets( $widgets_manager ) {
		if ( ! did_action( 'elementor/loaded' ) ) { return; }
		require_once SWM_PATH . 'widgets/class-swm-map-widget.php';
		$widgets_manager->register( new \WildMaps\Widgets\Map_Widget() );
	}

	public static function maptiler_key() {
		return get_option( 'swm_maptiler_api_key', '' );
	}

	public static function openrouteservice_key() {
		return get_option( 'swm_openrouteservice_api_key', '' );
	}
}
