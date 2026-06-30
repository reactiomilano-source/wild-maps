<?php
namespace WildMaps\Widgets;

if ( ! defined( 'ABSPATH' ) ) { exit; }

class Map_Widget extends \Elementor\Widget_Base {
	public function get_name() { return 'staywild_map'; }
	public function get_title() { return 'Wild Maps'; }
	public function get_icon() { return 'eicon-google-maps'; }
	public function get_categories() { return [ 'staywild' ]; }
	public function get_script_depends() { return [ 'swm-maplibre', 'swm-frontend' ]; }
	public function get_style_depends() { return [ 'swm-maplibre', 'swm-frontend' ]; }

	protected function register_controls() {
		$this->start_controls_section( 'section_map', [ 'label' => 'Content', 'tab' => \Elementor\Controls_Manager::TAB_CONTENT ] );

		$this->add_control( 'route_geojson_file', [
			'label' => 'File percorso GeoJSON',
			'type' => \Elementor\Controls_Manager::MEDIA,
				'dynamic' => [ 'active' => true ],
			'description' => 'File con LineString/MultiLineString generato da Mapshaper.',
			'media_types' => [ 'application/json', 'application/geo+json', 'text/plain' ],
		] );

		$this->add_control( 'route_geojson_url_manual', [
			'label' => 'URL percorso manuale',
			'type' => \Elementor\Controls_Manager::TEXT,
				'dynamic' => [ 'active' => true ],
			'placeholder' => 'https://stay-wild.it/wp-content/uploads/svaneti-route.json',
		] );

		$this->add_control( 'route_geojson_dynamic_url', [
			'label' => 'Dynamic URL percorso',
			'type' => \Elementor\Controls_Manager::URL,
			'dynamic' => [ 'active' => true ],
			'placeholder' => 'ACF file / URL percorso',
			'show_external' => false,
			'description' => 'Usa questo campo per Dynamic Tag ACF. Funziona con ACF File URL, ID o Array.',
		] );

		$this->add_control( 'points_geojson_file', [
			'label' => 'File punti GeoJSON',
			'type' => \Elementor\Controls_Manager::MEDIA,
				'dynamic' => [ 'active' => true ],
			'description' => 'File separato con i Point. Se vuoto, può usare i punti presenti nel file percorso.',
			'media_types' => [ 'application/json', 'application/geo+json', 'text/plain' ],
		] );

		$this->add_control( 'points_geojson_url_manual', [
			'label' => 'URL punti manuale',
			'type' => \Elementor\Controls_Manager::TEXT,
				'dynamic' => [ 'active' => true ],
			'placeholder' => 'https://stay-wild.it/wp-content/uploads/svaneti-points.json',
		] );

		$this->add_control( 'points_geojson_dynamic_url', [
			'label' => 'Dynamic URL punti',
			'type' => \Elementor\Controls_Manager::URL,
			'dynamic' => [ 'active' => true ],
			'placeholder' => 'ACF file / URL punti',
			'show_external' => false,
			'description' => 'Usa questo campo per Dynamic Tag ACF. Funziona con ACF File URL, ID o Array.',
		] );

		$this->add_control( 'map_style', [
			'label' => 'Stile mappa',
			'type' => \Elementor\Controls_Manager::SELECT,
				'dynamic' => [ 'active' => true ],
			'default' => 'outdoor-v2',
			'options' => [
				'outdoor-v2' => 'Outdoor',
				'landscape' => 'Landscape',
				'streets-v2' => 'Streets',
				'basic-v2' => 'Basic',
				'bright-v2' => 'Bright',
				'topo-v2' => 'Topo',
				'dataviz-dark' => 'Dark',
			],
		] );

		$this->add_control( 'height', [
			'label' => 'Altezza',
			'type' => \Elementor\Controls_Manager::SLIDER,
				'dynamic' => [ 'active' => true ],
			'size_units' => [ 'px', 'vh' ],
			'range' => [
				'px' => [ 'min' => 250, 'max' => 1200 ],
				'vh' => [ 'min' => 20, 'max' => 100 ],
			],
			'default' => [ 'unit' => 'px', 'size' => 600 ],
			'selectors' => [ '{{WRAPPER}} .swm-map' => 'height: {{SIZE}}{{UNIT}};' ],
		] );

		$this->add_control( 'center_lng', [ 'label' => 'Centro longitudine', 'type' => \Elementor\Controls_Manager::NUMBER,
				'dynamic' => [ 'active' => true ], 'default' => 42.72 ] );
		$this->add_control( 'center_lat', [ 'label' => 'Centro latitudine', 'type' => \Elementor\Controls_Manager::NUMBER,
				'dynamic' => [ 'active' => true ], 'default' => 43.04 ] );
		$this->add_control( 'zoom', [ 'label' => 'Zoom iniziale', 'type' => \Elementor\Controls_Manager::NUMBER,
				'dynamic' => [ 'active' => true ], 'default' => 7, 'min' => 1, 'max' => 18 ] );

		$this->add_control( 'auto_fit', [
			'label' => 'Auto zoom itinerario',
			'type' => \Elementor\Controls_Manager::SWITCHER,
			'label_on' => 'Sì',
			'label_off' => 'No',
			'return_value' => 'yes',
			'default' => 'yes',
		] );

		$this->add_control( 'show_geojson_points', [
			'label' => 'Mostra punti GeoJSON',
			'type' => \Elementor\Controls_Manager::SWITCHER,
			'label_on' => 'Sì',
			'label_off' => 'No',
			'return_value' => 'yes',
			'default' => 'yes',
			'description' => 'Mostra i marker dei file GeoJSON. Spegni per visualizzare solo la linea.',
		] );

		$this->add_control( 'enable_backend_points', [
			'label' => 'Mostra punti backend WordPress',
			'type' => \Elementor\Controls_Manager::SWITCHER,
			'label_on' => 'Sì',
			'label_off' => 'No',
			'return_value' => 'yes',
			'default' => '',
			'description' => 'Carica i punti creati da WordPress in Punti Mappa.',
		] );

		$this->add_control( 'backend_project_id', [
			'label' => 'Progetto Mappa backend',
			'type' => \Elementor\Controls_Manager::SELECT,
			'options' => \WildMaps\Plugin::get_map_projects_options(),
			'default' => '',
			'description' => 'Seleziona quale progetto caricare. Se lasci vuoto, carica tutti i punti backend/globali.',
			'condition' => [ 'enable_backend_points' => 'yes' ],
		] );

		$this->add_control( 'enable_backend_route', [
			'label' => 'Mostra percorso progetto backend',
			'type' => \Elementor\Controls_Manager::SWITCHER,
			'label_on' => 'Sì',
			'label_off' => 'No',
			'return_value' => 'yes',
			'default' => '',
			'description' => 'Carica il percorso salvato nel Progetto Mappa. Il file GeoJSON percorso resta disponibile e può essere usato al posto o insieme.',
		] );

		$this->add_control( 'point_name_field', [
			'label' => 'Campo nome pin',
			'type' => \Elementor\Controls_Manager::TEXT,
				'dynamic' => [ 'active' => true ],
			'default' => '',
			'placeholder' => 'Es. name, title, Nome',
			'description' => 'Se il GeoJSON usa un campo specifico, scrivilo qui.',
			'condition' => [ 'show_geojson_points' => 'yes' ],
		] );

		$this->add_control( 'skip_unnamed_points', [
			'label' => 'Nascondi punti senza nome',
			'type' => \Elementor\Controls_Manager::SWITCHER,
			'label_on' => 'Sì',
			'label_off' => 'No',
			'return_value' => 'yes',
			'default' => 'yes',
			'condition' => [ 'show_geojson_points' => 'yes' ],
		] );

		$this->add_control( 'enable_manual_points', [
			'label' => 'Abilita punti manuali',
			'type' => \Elementor\Controls_Manager::SWITCHER,
			'label_on' => 'Sì',
			'label_off' => 'No',
			'return_value' => 'yes',
			'default' => '',
		] );

		$this->add_control( 'manual_coordinate_order', [
			'label' => 'Ordine coordinate manuali',
			'type' => \Elementor\Controls_Manager::SELECT,
				'dynamic' => [ 'active' => true ],
			'default' => 'auto',
			'options' => [
				'auto' => 'Automatico consigliato',
				'lng_lat' => 'Longitudine | Latitudine',
				'lat_lng' => 'Latitudine | Longitudine',
			],
			'condition' => [ 'enable_manual_points' => 'yes' ],
		] );

		$this->add_control( 'manual_points', [
			'label' => 'Punti manuali',
			'type' => \Elementor\Controls_Manager::TEXTAREA,
				'dynamic' => [ 'active' => true ],
			'rows' => 7,
			'placeholder' => "Mestia | 42.7275 | 43.0435\nUshguli | 43.0110 | 42.9130",
			'description' => 'Formato: Nome | 42.7275 | 43.0435 | categoria. La categoria è opzionale.',
			'condition' => [ 'enable_manual_points' => 'yes' ],
		] );

		$this->add_control( 'show_marker_labels', [
			'label' => 'Mostra etichette sempre visibili',
			'type' => \Elementor\Controls_Manager::SWITCHER,
			'label_on' => 'Sì',
			'label_off' => 'No',
			'return_value' => 'yes',
			'default' => 'yes',
		] );

		$this->add_control( 'show_fullscreen_control', [
			'label' => 'Mostra pulsante fullscreen',
			'type' => \Elementor\Controls_Manager::SWITCHER,
			'label_on' => 'Sì',
			'label_off' => 'No',
			'return_value' => 'yes',
			'default' => 'yes',
			'description' => 'Aggiunge il controllo fullscreen sulla mappa nel frontend.',
		] );

		$this->end_controls_section();

		$this->start_controls_section( 'section_popup', [ 'label' => 'Popups', 'tab' => \Elementor\Controls_Manager::TAB_CONTENT ] );

		$this->add_control( 'show_popups', [
			'label' => 'Abilita popup',
			'type' => \Elementor\Controls_Manager::SWITCHER,
			'label_on' => 'Sì',
			'label_off' => 'No',
			'return_value' => 'yes',
			'default' => 'yes',
		] );

		$this->add_control( 'popup_gap', [
			'label' => 'Distanza popup',
			'type' => \Elementor\Controls_Manager::NUMBER,
				'dynamic' => [ 'active' => true ],
			'default' => 8,
			'min' => 0,
			'max' => 80,
			'condition' => [ 'show_popups' => 'yes' ],
		] );

		$this->end_controls_section();

		$this->start_controls_section( 'section_marker', [ 'label' => 'Markers', 'tab' => \Elementor\Controls_Manager::TAB_CONTENT ] );

		$this->add_control( 'native_marker_note', [
			'type' => \Elementor\Controls_Manager::RAW_HTML,
			'raw' => 'I marker sono sempre nativi MapLibre: restano corretti anche a zoom bassi. Puoi usare icone SVG diverse per GeoJSON e punti manuali.',
			'content_classes' => 'elementor-panel-alert elementor-panel-alert-info',
		] );

		$this->add_control( 'geojson_marker_svg', [
			'label' => 'SVG punti GeoJSON',
			'type' => \Elementor\Controls_Manager::MEDIA,
				'dynamic' => [ 'active' => true ],
			'description' => 'Icona SVG/PNG per i punti caricati dal file GeoJSON.',
			'media_types' => [ 'image/svg+xml', 'image' ],
		] );

		$this->add_control( 'geojson_marker_dynamic_url', [
			'label' => 'Dynamic URL SVG punti GeoJSON',
			'type' => \Elementor\Controls_Manager::URL,
			'dynamic' => [ 'active' => true ],
			'placeholder' => 'ACF file / URL icona GeoJSON',
			'show_external' => false,
		] );

		$this->add_control( 'backend_marker_svg', [
			'label' => 'SVG punti backend WordPress',
			'type' => \Elementor\Controls_Manager::MEDIA,
				'dynamic' => [ 'active' => true ],
			'description' => 'Icona SVG/PNG per i punti creati da Punti Mappa nel backend.',
			'media_types' => [ 'image/svg+xml', 'image' ],
		] );

		$this->add_control( 'backend_marker_dynamic_url', [
			'label' => 'Dynamic URL SVG punti backend',
			'type' => \Elementor\Controls_Manager::URL,
			'dynamic' => [ 'active' => true ],
			'placeholder' => 'ACF file / URL icona backend',
			'show_external' => false,
		] );

		$this->add_control( 'manual_marker_svg', [
			'label' => 'SVG punti manuali',
			'type' => \Elementor\Controls_Manager::MEDIA,
				'dynamic' => [ 'active' => true ],
			'description' => 'Icona SVG/PNG per i punti inseriti manualmente.',
			'media_types' => [ 'image/svg+xml', 'image' ],
		] );

		$this->add_control( 'manual_marker_dynamic_url', [
			'label' => 'Dynamic URL SVG punti manuali',
			'type' => \Elementor\Controls_Manager::URL,
			'dynamic' => [ 'active' => true ],
			'placeholder' => 'ACF file / URL icona manuali',
			'show_external' => false,
		] );

		$this->add_control( 'marker_size', [
			'label' => 'Dimensione marker',
			'type' => \Elementor\Controls_Manager::SLIDER,
				'dynamic' => [ 'active' => true ],
			'size_units' => [ 'px' ],
			'range' => [ 'px' => [ 'min' => 10, 'max' => 80 ] ],
			'default' => [ 'unit' => 'px', 'size' => 24 ],
		] );

		$this->add_control( 'geojson_marker_icon_size', [
			'label' => 'Dimensione icona GeoJSON',
			'type' => \Elementor\Controls_Manager::NUMBER,
			'dynamic' => [ 'active' => true ],
			'default' => 24,
			'min' => 8,
			'max' => 160,
		] );

		$this->add_control( 'backend_marker_icon_size', [
			'label' => 'Dimensione icona backend',
			'type' => \Elementor\Controls_Manager::NUMBER,
			'default' => 24,
			'min' => 8,
			'max' => 96,
		] );

		$this->add_control( 'manual_marker_icon_size', [
			'label' => 'Dimensione icona manuale',
			'type' => \Elementor\Controls_Manager::NUMBER,
			'dynamic' => [ 'active' => true ],
			'default' => 24,
			'min' => 8,
			'max' => 160,
		] );

		$this->end_controls_section();


		$this->start_controls_section( 'section_manual_categories', [ 'label' => 'Manual POI Categories', 'tab' => \Elementor\Controls_Manager::TAB_CONTENT ] );

		$this->add_control( 'manual_categories_info', [
			'type' => \Elementor\Controls_Manager::RAW_HTML,
			'raw' => 'Nei punti manuali usa: Nome | longitudine | latitudine | categoria. Le categorie sono libere per ogni mappa.',
			'content_classes' => 'elementor-panel-alert elementor-panel-alert-info',
		] );

		$manual_category_defaults = [
			1 => [ 'placeholder' => 'città', 'color' => '#e63b2e' ],
			2 => [ 'placeholder' => 'montagna', 'color' => '#111111' ],
			3 => [ 'placeholder' => 'campeggio', 'color' => '#4aa3df' ],
		];

		for ( $i = 1; $i <= 10; $i++ ) {
			$category_default = $manual_category_defaults[ $i ] ?? [
				'placeholder' => 'categoria-' . $i,
				'color'       => ( 0 === $i % 3 ) ? '#4aa3df' : ( ( 0 === $i % 2 ) ? '#111111' : '#e63b2e' ),
			];

			$this->add_control( 'manual_cat_' . $i . '_name', [
				'label'       => 'Categoria ' . $i . ' nome',
				'type'        => \Elementor\Controls_Manager::TEXT,
				'dynamic'     => [ 'active' => true ],
				'default'     => '',
				'placeholder' => $category_default['placeholder'],
			] );

			$this->add_control( 'manual_cat_' . $i . '_icon', [
				'label'       => 'Categoria ' . $i . ' icona',
				'type'        => \Elementor\Controls_Manager::MEDIA,
				'dynamic'     => [ 'active' => true ],
				'media_types' => [ 'image/svg+xml', 'image' ],
			] );

			$this->add_control( 'manual_cat_' . $i . '_color', [
				'label'   => 'Categoria ' . $i . ' colore fallback',
				'type'    => \Elementor\Controls_Manager::COLOR,
				'dynamic' => [ 'active' => true ],
				'default' => $category_default['color'],
			] );

			if ( $i < 10 ) {
				$this->add_control( 'manual_cat_' . $i . '_divider', [
					'type' => \Elementor\Controls_Manager::DIVIDER,
				] );
			}
		}

		$this->end_controls_section();

		$this->start_controls_section( 'section_style_map', [
			'label' => 'Style · Map & Route',
			'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
		] );

		$this->add_control( 'route_color', [
			'label'   => 'Colore percorso',
			'type'    => \Elementor\Controls_Manager::COLOR,
			'dynamic' => [ 'active' => true ],
			'default' => '#e63b2e',
		] );

		$this->add_control( 'route_width', [
			'label'   => 'Spessore percorso',
			'type'    => \Elementor\Controls_Manager::NUMBER,
			'dynamic' => [ 'active' => true ],
			'default' => 4,
			'min'     => 1,
			'max'     => 20,
		] );

		$this->add_control( 'border_radius', [
			'label'      => 'Border radius mappa',
			'type'       => \Elementor\Controls_Manager::SLIDER,
			'dynamic'    => [ 'active' => true ],
			'size_units' => [ 'px' ],
			'range'      => [ 'px' => [ 'min' => 0, 'max' => 80 ] ],
			'default'    => [ 'unit' => 'px', 'size' => 20 ],
			'selectors'  => [ '{{WRAPPER}} .swm-map' => 'border-radius: {{SIZE}}{{UNIT}};' ],
		] );

		$this->end_controls_section();

		$this->start_controls_section( 'section_style_markers', [
			'label' => 'Style · Markers',
			'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
		] );

		$this->add_control( 'geojson_marker_color', [
			'label'   => 'Colore marker GeoJSON',
			'type'    => \Elementor\Controls_Manager::COLOR,
			'dynamic' => [ 'active' => true ],
			'default' => '#e63b2e',
		] );

		$this->add_control( 'manual_marker_color', [
			'label'   => 'Colore marker manuali',
			'type'    => \Elementor\Controls_Manager::COLOR,
			'dynamic' => [ 'active' => true ],
			'default' => '#111111',
		] );

		$this->add_control( 'backend_marker_color', [
			'label'   => 'Colore marker backend',
			'type'    => \Elementor\Controls_Manager::COLOR,
			'dynamic' => [ 'active' => true ],
			'default' => '#111111',
		] );

		$this->add_control( 'marker_color', [
			'label'       => 'Colore marker fallback',
			'type'        => \Elementor\Controls_Manager::COLOR,
			'dynamic'     => [ 'active' => true ],
			'default'     => '#e63b2e',
			'description' => 'Usato solo se non è impostato un colore specifico per sorgente.',
		] );

		$this->end_controls_section();

		$this->start_controls_section( 'section_style_labels', [
			'label' => 'Style · Labels',
			'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
		] );

		$this->add_control( 'label_color', [
			'label'   => 'Colore etichette',
			'type'    => \Elementor\Controls_Manager::COLOR,
			'dynamic' => [ 'active' => true ],
			'default' => '#111111',
		] );

		$this->add_control( 'label_font_family', [
			'label'       => 'Font family etichette',
			'type'        => \Elementor\Controls_Manager::TEXT,
			'dynamic'     => [ 'active' => true ],
			'default'     => '',
			'placeholder' => 'LFT Etica',
			'description' => 'Usato per le etichette native MapLibre.',
		] );

		$this->add_control( 'label_font_size', [
			'label'   => 'Dimensione etichette generale',
			'type'    => \Elementor\Controls_Manager::NUMBER,
			'dynamic' => [ 'active' => true ],
			'default' => 12,
			'min'     => 8,
			'max'     => 40,
		] );

		$this->add_control( 'label_font_weight', [
			'label'   => 'Peso etichette',
			'type'    => \Elementor\Controls_Manager::SELECT,
			'dynamic' => [ 'active' => true ],
			'default' => '700',
			'options' => [
				'400' => '400',
				'500' => '500',
				'600' => '600',
				'700' => '700',
				'800' => '800',
			],
		] );

		$this->add_control( 'label_sizes_heading', [
			'label'     => 'Dimensioni per sorgente',
			'type'      => \Elementor\Controls_Manager::HEADING,
			'separator' => 'before',
		] );

		$this->add_control( 'geojson_label_font_size', [
			'label'   => 'Dimensione etichette GeoJSON',
			'type'    => \Elementor\Controls_Manager::NUMBER,
			'dynamic' => [ 'active' => true ],
			'default' => 12,
			'min'     => 8,
			'max'     => 48,
		] );

		$this->add_control( 'backend_label_font_size', [
			'label'   => 'Dimensione etichette backend',
			'type'    => \Elementor\Controls_Manager::NUMBER,
			'dynamic' => [ 'active' => true ],
			'default' => 12,
			'min'     => 8,
			'max'     => 48,
		] );

		$this->add_control( 'manual_label_font_size', [
			'label'   => 'Dimensione etichette manuali',
			'type'    => \Elementor\Controls_Manager::NUMBER,
			'dynamic' => [ 'active' => true ],
			'default' => 12,
			'min'     => 8,
			'max'     => 48,
		] );

		$this->end_controls_section();

		$this->start_controls_section( 'section_style_manual_categories', [
			'label' => 'Style · Manual Categories',
			'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
		] );

		for ( $i = 1; $i <= 10; $i++ ) {
			$this->add_control( 'manual_cat_' . $i . '_style_heading', [
				'label'     => 'Categoria ' . $i,
				'type'      => \Elementor\Controls_Manager::HEADING,
				'separator' => ( 1 === $i ) ? 'none' : 'before',
			] );

			$this->add_control( 'manual_cat_' . $i . '_icon_size', [
				'label'   => 'Dimensione icona',
				'type'    => \Elementor\Controls_Manager::NUMBER,
				'dynamic' => [ 'active' => true ],
				'default' => 24,
				'min'     => 8,
				'max'     => 160,
			] );

			$this->add_control( 'manual_cat_' . $i . '_label_size', [
				'label'   => 'Dimensione etichetta',
				'type'    => \Elementor\Controls_Manager::NUMBER,
				'dynamic' => [ 'active' => true ],
				'default' => 12,
				'min'     => 8,
				'max'     => 48,
			] );

			$this->add_control( 'manual_cat_' . $i . '_dynamic_icon_url', [
				'label'       => 'Dynamic URL icona',
				'type'        => \Elementor\Controls_Manager::URL,
				'dynamic'     => [ 'active' => true ],
				'placeholder' => 'ACF file / URL icona categoria',
				'show_external' => false,
			] );
		}

		$this->end_controls_section();

		$this->start_controls_section( 'section_style_popup', [
			'label' => 'Style · Popups',
			'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
		] );

		$this->add_control( 'popup_font_family', [
			'label'       => 'Font family popup',
			'type'        => \Elementor\Controls_Manager::TEXT,
			'dynamic'     => [ 'active' => true ],
			'default'     => '',
			'placeholder' => 'LFT Etica',
		] );

		$this->add_control( 'popup_font_size', [
			'label'   => 'Dimensione popup',
			'type'    => \Elementor\Controls_Manager::NUMBER,
			'dynamic' => [ 'active' => true ],
			'default' => 14,
			'min'     => 8,
			'max'     => 40,
		] );

		$this->add_control( 'popup_font_weight', [
			'label'   => 'Peso popup',
			'type'    => \Elementor\Controls_Manager::SELECT,
			'dynamic' => [ 'active' => true ],
			'default' => '700',
			'options' => [
				'400' => '400',
				'500' => '500',
				'600' => '600',
				'700' => '700',
				'800' => '800',
			],
		] );

		$this->end_controls_section();

	}

	private function media_url( $settings, $media_key, $manual_key = '' ) {
		if ( $manual_key && isset( $settings[ $manual_key ] ) ) {
			$url = $this->resolve_file_url( $settings[ $manual_key ] );
			if ( $url ) { return $url; }
		}

		if ( isset( $settings[ $media_key ] ) ) {
			$url = $this->resolve_file_url( $settings[ $media_key ] );
			if ( $url ) { return $url; }
		}

		return '';
	}

	private function resolve_file_url( $value ) {
		if ( empty( $value ) ) {
			return '';
		}

		if ( is_array( $value ) ) {
			if ( ! empty( $value['url'] ) ) {
				return esc_url_raw( $value['url'] );
			}

			if ( ! empty( $value['id'] ) ) {
				$url = wp_get_attachment_url( intval( $value['id'] ) );
				if ( $url ) { return esc_url_raw( $url ); }
			}

			if ( ! empty( $value['ID'] ) ) {
				$url = wp_get_attachment_url( intval( $value['ID'] ) );
				if ( $url ) { return esc_url_raw( $url ); }
			}

			if ( ! empty( $value['value'] ) ) {
				return $this->resolve_file_url( $value['value'] );
			}

			return '';
		}

		if ( is_numeric( $value ) ) {
			$url = wp_get_attachment_url( intval( $value ) );
			if ( $url ) { return esc_url_raw( $url ); }
		}

		if ( is_string( $value ) ) {
			$value = trim( $value );

			if ( '' === $value ) {
				return '';
			}

			if ( 0 === strpos( $value, '{' ) || 0 === strpos( $value, '[' ) ) {
				$decoded = json_decode( $value, true );
				if ( json_last_error() === JSON_ERROR_NONE ) {
					$url = $this->resolve_file_url( $decoded );
					if ( $url ) { return $url; }
				}
			}

			if ( preg_match( '/^[0-9]+$/', $value ) ) {
				$url = wp_get_attachment_url( intval( $value ) );
				if ( $url ) { return esc_url_raw( $url ); }
			}

			if ( filter_var( $value, FILTER_VALIDATE_URL ) ) {
				return esc_url_raw( $value );
			}
		}

		return '';
	}

	private function color_value( $settings, $key, $fallback ) {
		if ( ! empty( $settings[ $key ] ) && is_string( $settings[ $key ] ) && 0 === strpos( $settings[ $key ], '#' ) ) {
			$color = sanitize_hex_color( $settings[ $key ] );
			if ( $color ) { return $color; }
		}

		if ( ! empty( $settings['__globals__'][ $key ] ) ) {
			$global = $this->elementor_global_color( $settings['__globals__'][ $key ] );
			if ( $global ) { return $global; }
		}

		return $fallback;
	}

	private function elementor_global_color( $global_ref ) {
		if ( ! is_string( $global_ref ) || false === strpos( $global_ref, 'globals/colors?id=' ) ) {
			return '';
		}

		$global_id = substr( $global_ref, strpos( $global_ref, 'globals/colors?id=' ) + strlen( 'globals/colors?id=' ) );
		$global_id = sanitize_text_field( $global_id );

		if ( ! class_exists( '\\Elementor\\Plugin' ) ) {
			return '';
		}

		$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit();
		if ( ! $kit ) {
			return '';
		}

		$settings = $kit->get_settings();

		$groups = [ 'system_colors', 'custom_colors' ];
		foreach ( $groups as $group ) {
			if ( empty( $settings[ $group ] ) || ! is_array( $settings[ $group ] ) ) {
				continue;
			}

			foreach ( $settings[ $group ] as $color_item ) {
				if ( ! empty( $color_item['_id'] ) && $global_id === $color_item['_id'] && ! empty( $color_item['color'] ) ) {
					$color = sanitize_hex_color( $color_item['color'] );
					if ( $color ) { return $color; }
				}
			}
		}

		return '';
	}

	protected function render() {
		$settings = $this->get_settings_for_display();

		$route_url = $this->media_url( $settings, 'route_geojson_file', 'route_geojson_dynamic_url' );
		if ( ! $route_url ) { $route_url = $this->media_url( $settings, 'route_geojson_file', 'route_geojson_url_manual' ); }
		$points_url = $this->media_url( $settings, 'points_geojson_file', 'points_geojson_dynamic_url' );
		if ( ! $points_url ) { $points_url = $this->media_url( $settings, 'points_geojson_file', 'points_geojson_url_manual' ); }
		$geojson_marker_svg_url = $this->media_url( $settings, 'geojson_marker_svg', 'geojson_marker_dynamic_url' );
		$manual_marker_svg_url = $this->media_url( $settings, 'manual_marker_svg', 'manual_marker_dynamic_url' );
		$backend_marker_svg_url = $this->media_url( $settings, 'backend_marker_svg', 'backend_marker_dynamic_url' );

		$marker_size = 24;
		if ( isset( $settings['marker_size']['size'] ) ) { $marker_size = intval( $settings['marker_size']['size'] ); }


		$manual_categories = [];
		for ( $i = 1; $i <= 10; $i++ ) {
			$name_key  = 'manual_cat_' . $i . '_name';
			$icon_key  = 'manual_cat_' . $i . '_icon';
			$color_key = 'manual_cat_' . $i . '_color';

			$name = sanitize_text_field( $settings[ $name_key ] ?? '' );
			if ( '' === $name ) {
				continue;
			}

			$dynamic_icon_key = 'manual_cat_' . $i . '_dynamic_icon_url';
			$icon_url = $this->media_url( $settings, $icon_key, $dynamic_icon_key );

			$icon_size_key  = 'manual_cat_' . $i . '_icon_size';
			$label_size_key = 'manual_cat_' . $i . '_label_size';

			$manual_categories[] = [
				'name'      => $name,
				'key'       => sanitize_title( $name ),
				'icon'      => $icon_url,
				'color'     => $this->color_value( $settings, $color_key, '#e63b2e' ),
				'iconSize'  => intval( $settings[ $icon_size_key ] ?? 24 ),
				'labelSize' => intval( $settings[ $label_size_key ] ?? 12 ),
			];
		}

		$config = [
			'routeGeojsonUrl'       => $route_url,
			'pointsGeojsonUrl'      => $points_url,
			'apiKey'                => \WildMaps\Plugin::maptiler_key(),
			'mapStyle'              => sanitize_text_field( $settings['map_style'] ?? 'outdoor-v2' ),
			'center'                => [ floatval( $settings['center_lng'] ?? 42.72 ), floatval( $settings['center_lat'] ?? 43.04 ) ],
			'zoom'                  => intval( $settings['zoom'] ?? 7 ),
			'autoFit'               => ( isset( $settings['auto_fit'] ) && 'yes' === $settings['auto_fit'] ),
			'showGeojsonPoints'     => ( isset( $settings['show_geojson_points'] ) && 'yes' === $settings['show_geojson_points'] ),
			'enableBackendPoints'   => ( isset( $settings['enable_backend_points'] ) && 'yes' === $settings['enable_backend_points'] ),
			'backendPointsUrl'      => rest_url( 'wild-maps/v1/points' ),
			'enableBackendRoute'    => ( isset( $settings['enable_backend_route'] ) && 'yes' === $settings['enable_backend_route'] ),
			'backendRouteUrl'       => rest_url( 'wild-maps/v1/route' ),
			'backendProjectId'     => absint( $settings['backend_project_id'] ?? 0 ),
			'routeColor'            => $this->color_value( $settings, 'route_color', '#e63b2e' ),
			'routeWidth'            => intval( $settings['route_width'] ?? 4 ),
			'markerColor'           => $this->color_value( $settings, 'marker_color', '#e63b2e' ),
			'geojsonMarkerColor'    => $this->color_value( $settings, 'geojson_marker_color', $this->color_value( $settings, 'marker_color', '#e63b2e' ) ),
			'manualMarkerColor'     => $this->color_value( $settings, 'manual_marker_color', '#111111' ),
			'backendMarkerColor'    => $this->color_value( $settings, 'backend_marker_color', '#111111' ),
			'labelColor'            => $this->color_value( $settings, 'label_color', '#111111' ),
			'labelFontFamily'       => sanitize_text_field( $settings['label_font_family'] ?? '' ),
			'labelFontSize'         => intval( $settings['label_font_size'] ?? 12 ),
			'labelFontWeight'       => sanitize_text_field( $settings['label_font_weight'] ?? '700' ),
			'popupFontFamily'       => sanitize_text_field( $settings['popup_font_family'] ?? '' ),
			'popupFontSize'         => intval( $settings['popup_font_size'] ?? 14 ),
			'popupFontWeight'       => sanitize_text_field( $settings['popup_font_weight'] ?? '700' ),
			'pointNameField'        => sanitize_text_field( $settings['point_name_field'] ?? '' ),
			'skipUnnamedPoints'     => ( isset( $settings['skip_unnamed_points'] ) && 'yes' === $settings['skip_unnamed_points'] ),
			'enableManualPoints'    => ( isset( $settings['enable_manual_points'] ) && 'yes' === $settings['enable_manual_points'] ),
			'manualCoordinateOrder' => sanitize_text_field( $settings['manual_coordinate_order'] ?? 'auto' ),
			'manualPoints'          => sanitize_textarea_field( $settings['manual_points'] ?? '' ),
			'manualCategories'      => $manual_categories,
			'showMarkerLabels'      => ( isset( $settings['show_marker_labels'] ) && 'yes' === $settings['show_marker_labels'] ),
			'showFullscreenControl'=> ( isset( $settings['show_fullscreen_control'] ) && 'yes' === $settings['show_fullscreen_control'] ),
			'showPopups'            => ( isset( $settings['show_popups'] ) && 'yes' === $settings['show_popups'] ),
			'popupGap'              => intval( $settings['popup_gap'] ?? 8 ),
			'geojsonMarkerSvgUrl'   => $geojson_marker_svg_url,
			'manualMarkerSvgUrl'    => $manual_marker_svg_url,
			'backendMarkerSvgUrl'   => $backend_marker_svg_url,
			'markerSize'            => $marker_size,
			'geojsonMarkerIconSize' => intval( $settings['geojson_marker_icon_size'] ?? $marker_size ),
			'manualMarkerIconSize'  => intval( $settings['manual_marker_icon_size'] ?? $marker_size ),
			'backendMarkerIconSize' => intval( $settings['backend_marker_icon_size'] ?? $marker_size ),
			'geojsonLabelFontSize'  => intval( $settings['geojson_label_font_size'] ?? 12 ),
			'manualLabelFontSize'   => intval( $settings['manual_label_font_size'] ?? 12 ),
			'backendLabelFontSize'  => intval( $settings['backend_label_font_size'] ?? 12 ),
		];

		$map_id = 'swm-map-' . esc_attr( $this->get_id() );
		?>
		<div class="swm-map-wrap">
			<div id="<?php echo esc_attr( $map_id ); ?>" class="swm-map" data-swm-map='<?php echo esc_attr( wp_json_encode( $config ) ); ?>'></div>
			<?php if ( empty( $config['apiKey'] ) ) : ?>
				<div class="swm-map-notice">Inserisci la MapTiler API Key in <strong>Wild Maps → Settings</strong>.</div>
			<?php elseif ( empty( $route_url ) && empty( $points_url ) && empty( $settings['manual_points'] ) && empty( $settings['enable_backend_points'] ) && empty( $settings['enable_backend_route'] ) ) : ?>
				<div class="swm-map-notice">Seleziona almeno un file GeoJSON oppure abilita punti manuali.</div>
			<?php endif; ?>
		</div>
		<?php
	}
}
