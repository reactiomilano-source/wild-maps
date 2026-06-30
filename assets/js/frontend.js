(function () {
	'use strict';

	function escapeHtml(value) {
		return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
	}
	function normalizeText(value) { if (value === null || typeof value === 'undefined') return ''; return String(value).trim(); }
	function swmSlug(value) {
		return normalizeText(value)
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}
	function looksLikeBadAdminName(value) {
		var text = normalizeText(value).toLowerCase();
		if (!text) return true;
		var badFragments = ['municipalità','municipalita','municipality','comune di','province of','provincia di','region of','regione di','administrative','boundary','unknown','unnamed'];
		return badFragments.some(function (fragment) { return text.indexOf(fragment) !== -1; });
	}
	function stripHtml(value) { var div = document.createElement('div'); div.innerHTML = String(value || ''); return normalizeText(div.textContent || div.innerText || ''); }

	function collectCoordinates(geometry, output) {
		if (!geometry) return;
		if (geometry.type === 'Point') { output.push(geometry.coordinates); return; }
		if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') { geometry.coordinates.forEach(function (coord) { output.push(coord); }); return; }
		if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') { geometry.coordinates.forEach(function (line) { line.forEach(function (coord) { output.push(coord); }); }); return; }
		if (geometry.type === 'MultiPolygon') { geometry.coordinates.forEach(function (poly) { poly.forEach(function (line) { line.forEach(function (coord) { output.push(coord); }); }); }); return; }
		if (geometry.type === 'GeometryCollection') { geometry.geometries.forEach(function (child) { collectCoordinates(child, output); }); }
	}

	function getPropertyCaseInsensitive(properties, key) {
		if (!properties || !key) return '';
		if (Object.prototype.hasOwnProperty.call(properties, key)) return properties[key];
		var wanted = String(key).toLowerCase();
		var foundKey = Object.keys(properties).find(function (propKey) { return String(propKey).toLowerCase() === wanted; });
		return foundKey ? properties[foundKey] : '';
	}

	function getName(feature, config) {
		if (!feature || !feature.properties) return '';
		var properties = feature.properties;
		var manualField = normalizeText(config.pointNameField);
		if (manualField) {
			var manualValue = normalizeText(getPropertyCaseInsensitive(properties, manualField));
			if (manualValue && !looksLikeBadAdminName(manualValue)) return stripHtml(manualValue);
		}
		var preferredKeys = ['sw_name','swm_name','sw_title','title','Title','TITLE','nome','Nome','NOME','name','Name','NAME','localita','località','Località','place','Place','label','Label','waypoint','Waypoint'];
		var fallback = '';
		for (var i = 0; i < preferredKeys.length; i++) {
			var value = normalizeText(getPropertyCaseInsensitive(properties, preferredKeys[i]));
			if (!value) continue;
			value = stripHtml(value);
			if (!fallback) fallback = value;
			if (!looksLikeBadAdminName(value)) return value;
		}
		if (properties.description) {
			var description = stripHtml(properties.description);
			if (description && !looksLikeBadAdminName(description) && description.length < 80) return description;
		}
		if (fallback && !looksLikeBadAdminName(fallback)) return fallback;
		return '';
	}

	function smartSplitManualLine(line) {
		if (line.indexOf('|') !== -1) return line.split('|');
		if (line.indexOf(';') !== -1) return line.split(';');
		if (line.indexOf('\t') !== -1) return line.split('\t');
		var match = line.match(/^(.+?)\s+(-?\d+(?:[\.,]\d+)?)\s+(-?\d+(?:[\.,]\d+)?)$/);
		return match ? [match[1], match[2], match[3]] : [];
	}
	function looksLikeGeorgiaLatLng(a, b) { return (a >= 40 && a <= 44.5 && b >= 40 && b <= 47.5); }
	function looksLikeGeorgiaLngLat(a, b) { return (a >= 40 && a <= 47.5 && b >= 40 && b <= 44.5); }
	function resolveManualLngLat(a, b, order) {
		if (order === 'lat_lng') return [b, a];
		if (order === 'lng_lat') return [a, b];
		if (looksLikeGeorgiaLatLng(a, b) && !(a > 44.5)) return [b, a];
		if (looksLikeGeorgiaLngLat(a, b)) return [a, b];
		if (Math.abs(a) <= 90 && Math.abs(b) > 90 && Math.abs(b) <= 180) return [b, a];
		if (Math.abs(a) <= 180 && Math.abs(b) <= 90) return [a, b];
		return [a, b];
	}
	function parseManualPoints(config) {
		if (!config.enableManualPoints) return [];
		var raw = config.manualPoints || '';
		if (!raw) return [];
		return raw.split(/\r?\n/).map(function (line) {
			line = normalizeText(line);
			if (!line) return null;
			var parts = smartSplitManualLine(line).map(function (p) { return normalizeText(p); });
			if (parts.length < 3) return null;
			var a = parseFloat(parts[1].replace(',', '.'));
			var b = parseFloat(parts[2].replace(',', '.'));
			if (!parts[0] || isNaN(a) || isNaN(b)) return null;
			var pair = resolveManualLngLat(a, b, config.manualCoordinateOrder || 'auto');
			var category = parts[3] ? parts[3] : '';
			return { type: 'Feature', properties: { sw_name: parts[0], swm_name: parts[0], swm_source: 'manual', swm_category: category, swm_category_key: swmSlug(category) }, geometry: { type: 'Point', coordinates: pair } };
		}).filter(Boolean);
	}

	function pointFeaturesFromGeojson(geojson, config) {
		var points = [];
		if (!geojson || !config.showGeojsonPoints) return points;
		function addFeaturePoint(feature, coords) {
			var name = getName(feature, config);
			if (!name && config.skipUnnamedPoints) return;
			var props = Object.assign({}, feature.properties || {});
			props.swm_name = name || '';
			props.swm_source = 'geojson';
			points.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: coords } });
		}
		function scanFeature(feature) {
			if (!feature || !feature.geometry) return;
			if (feature.geometry.type === 'Point') addFeaturePoint(feature, feature.geometry.coordinates);
			if (feature.geometry.type === 'MultiPoint') feature.geometry.coordinates.forEach(function (coords) { addFeaturePoint(feature, coords); });
			if (feature.geometry.type === 'GeometryCollection') feature.geometry.geometries.forEach(function (geometry) { scanFeature({ type: 'Feature', properties: feature.properties || {}, geometry: geometry }); });
		}
		if (geojson.type === 'FeatureCollection') geojson.features.forEach(scanFeature);
		else if (geojson.type === 'Feature') scanFeature(geojson);
		return points;
	}

	function imageName(prefix, mapId) {
		return 'swm-' + prefix + '-' + mapId;
	}

	function addImageToMap(map, name, image) {
		try {
			if (!map.hasImage(name)) map.addImage(name, image);
			return true;
		} catch (e) {
			console.warn('Wild Maps: addImage fallito', name, e);
			return false;
		}
	}

	function loadImageElement(url) {
		return new Promise(function (resolve) {
			var img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = function () { resolve(img); };
			img.onerror = function () { resolve(null); };
			img.src = url;
		});
	}

	function loadSvgAsImage(url) {
		return fetch(url, { cache: 'no-store', credentials: 'same-origin' })
			.then(function (response) {
				if (!response.ok) throw new Error('SVG non caricata: ' + response.status);
				return response.text();
			})
			.then(function (svgText) {
				var blob = new Blob([svgText], { type: 'image/svg+xml' });
				var objectUrl = URL.createObjectURL(blob);
				return loadImageElement(objectUrl).then(function (img) {
					URL.revokeObjectURL(objectUrl);
					return img;
				});
			})
			.catch(function () { return null; });
	}

	function loadMapImage(map, name, url) {
		if (!url) return Promise.resolve(false);

		var cleanUrl = String(url).split('?')[0].toLowerCase();
		var isSvg = cleanUrl.slice(-4) === '.svg';

		if (isSvg) {
			return loadSvgAsImage(url).then(function (image) {
				if (!image) {
					console.warn('Wild Maps: impossibile caricare SVG marker', url);
					return false;
				}
				return addImageToMap(map, name, image);
			});
		}

		return new Promise(function (resolve) {
			map.loadImage(url, function (error, image) {
				if (error || !image) {
					loadImageElement(url).then(function (fallbackImage) {
						if (!fallbackImage) {
							console.warn('Wild Maps: impossibile caricare marker custom', url, error);
							resolve(false);
							return;
						}
						resolve(addImageToMap(map, name, fallbackImage));
					});
					return;
				}
				resolve(addImageToMap(map, name, image));
			});
		});
	}

	function addCircleLayer(map, id, source, config, filter) {
		map.addLayer({
			id: id,
			type: 'circle',
			source: source,
			filter: filter,
			paint: {
				'circle-radius': [
					'case',
					['has', 'swm_icon_size'],
					['max', 5, ['/', ['to-number', ['get', 'swm_icon_size']], 3]],
					['==', ['get', 'swm_source'], 'manual'],
					Math.max(5, (config.manualMarkerIconSize || config.markerSize || 24) / 3),
					['==', ['get', 'swm_source'], 'backend'],
					Math.max(5, (config.backendMarkerIconSize || config.markerSize || 24) / 3),
					Math.max(5, (config.geojsonMarkerIconSize || config.markerSize || 24) / 3)
				],
				'circle-color': [
					'case',
					['==', ['get', 'swm_source'], 'manual'],
					['coalesce', ['get', 'swm_color'], config.manualMarkerColor || '#111111'],
					['==', ['get', 'swm_source'], 'backend'],
					config.backendMarkerColor || '#111111',
					config.geojsonMarkerColor || config.markerColor || '#e63b2e'
				],
				'circle-stroke-width': 3,
				'circle-stroke-color': '#ffffff'
			}
		});
	}

	function addSymbolIconLayer(map, id, source, iconName, config, filter) {
		map.addLayer({
			id: id,
			type: 'symbol',
			source: source,
			filter: filter,
			layout: {
				'icon-image': iconName,
				'icon-size': [
					'case',
					['has', 'swm_icon_size'],
					['/', ['to-number', ['get', 'swm_icon_size']], 32],
					['==', ['get', 'swm_source'], 'manual'],
					Math.max(0.1, (config.manualMarkerIconSize || config.markerSize || 24) / 32),
					['==', ['get', 'swm_source'], 'backend'],
					Math.max(0.1, (config.backendMarkerIconSize || config.markerSize || 24) / 32),
					Math.max(0.1, (config.geojsonMarkerIconSize || config.markerSize || 24) / 32)
				],
				'icon-anchor': 'center',
				'icon-allow-overlap': true,
				'icon-ignore-placement': true
			}
		});
	}

	
	function mapLibreTextFont(config) {
		var weight = String(config.labelFontWeight || '700');
		if (weight === '400' || weight === '500') return ['Noto Sans Regular'];
		return ['Noto Sans Bold'];
	}

	function popupStyle(config) {
		var style = '';
		if (config.popupFontFamily) style += 'font-family:' + String(config.popupFontFamily).replace(/"/g, '') + ', sans-serif;';
		if (config.popupFontSize) style += 'font-size:' + parseInt(config.popupFontSize, 10) + 'px;';
		if (config.popupFontWeight) style += 'font-weight:' + parseInt(config.popupFontWeight, 10) + ';';
		return style;
	}

function addLabelLayer(map, source, config) {
		if (!config.showMarkerLabels) return;
		map.addLayer({
			id: 'swm-points-label',
			type: 'symbol',
			source: source,
			layout: {
				'text-field': ['case', ['==', ['get', 'swm_label'], '0'], '', ['get', 'swm_name']],
				'text-size': [
					'case',
					['has', 'swm_label_size'],
					['to-number', ['get', 'swm_label_size']],
					['==', ['get', 'swm_source'], 'manual'],
					parseInt(config.manualLabelFontSize || config.labelFontSize || 12, 10),
					['==', ['get', 'swm_source'], 'backend'],
					parseInt(config.backendLabelFontSize || config.labelFontSize || 12, 10),
					parseInt(config.geojsonLabelFontSize || config.labelFontSize || 12, 10)
				],
				'text-font': mapLibreTextFont(config),
				'text-offset': [0, 1.25],
				'text-anchor': 'top',
				'text-allow-overlap': true,
				'text-ignore-placement': true
			},
			paint: {
				'text-color': config.labelColor || '#111111',
				'text-halo-color': '#ffffff',
				'text-halo-width': 2
			}
		});
	}

	function addPopupHandlers(map, layerIds, config) {
		if (!config.showPopups) return;
		layerIds.forEach(function (layerId) {
			map.on('click', layerId, function (e) {
				if (!e.features || !e.features[0]) return;
				var feature = e.features[0];
				var name = feature.properties.swm_name || '';
				if (!name) return;
				new maplibregl.Popup({ closeButton: false, closeOnClick: true, offset: Number(config.popupGap || 8) })
					.setLngLat(feature.geometry.coordinates)
					.setHTML('<div class="swm-maplibre-popup" style="' + popupStyle(config) + '"><strong>' + escapeHtml(name) + '</strong></div>')
					.addTo(map);
			});
			map.on('mouseenter', layerId, function () { map.getCanvas().style.cursor = 'pointer'; });
			map.on('mouseleave', layerId, function () { map.getCanvas().style.cursor = ''; });
		});
	}

	
	function manualCategoryMap(config) {
		var out = {};
		(config.manualCategories || []).forEach(function (cat) {
			var key = cat.key || swmSlug(cat.name || '');
			if (!key) return;
			out[key] = { name: cat.name || '', icon: cat.icon || '', color: cat.color || '', iconSize: cat.iconSize || 24, labelSize: cat.labelSize || 12 };
		});
		return out;
	}

	function enrichManualCategories(features, config) {
		var cats = manualCategoryMap(config);
		return features.map(function (feature) {
			if (!feature.properties || feature.properties.swm_source !== 'manual') return feature;
			var props = Object.assign({}, feature.properties);
			var key = props.swm_category_key || swmSlug(props.swm_category || '');
			if (key && cats[key]) {
				props.swm_category_key = key;
				props.swm_icon = cats[key].icon || '';
				props.swm_color = cats[key].color || '';
				props.swm_icon_size = cats[key].iconSize || config.manualMarkerIconSize || config.markerSize || 24;
				props.swm_label_size = cats[key].labelSize || config.manualLabelFontSize || config.labelFontSize || 12;
			}
			return { type: 'Feature', properties: props, geometry: feature.geometry };
		});
	}


	function ensureManualStyleProps(features, config) {
		return features.map(function (feature) {
			if (!feature.properties || feature.properties.swm_source !== 'manual') return feature;
			var props = Object.assign({}, feature.properties);
			if (!props.swm_icon_size) props.swm_icon_size = config.manualMarkerIconSize || config.markerSize || 24;
			if (!props.swm_label_size) props.swm_label_size = config.manualLabelFontSize || config.labelFontSize || 12;
			return { type: 'Feature', properties: props, geometry: feature.geometry };
		});
	}


	function iconKeyFromUrl(url) {
		return 'backend-' + swmSlug(String(url || '').replace(/^https?:\/\//, '').replace(/\?.*$/, ''));
	}

	function ensureBackendStyleProps(features, config) {
		var cats = manualCategoryMap(config);
		return features.map(function (feature) {
			if (!feature.properties || feature.properties.swm_source !== 'backend') return feature;
			var props = Object.assign({}, feature.properties);
			var key = props.swm_category_key || swmSlug(props.swm_category || '');
			var cat = key && cats[key] ? cats[key] : null;

			// Priorità icone POI backend:
			// 1) icona caricata sul singolo POI; 2) icona categoria Elementor; 3) icona backend generale; 4) cerchio fallback.
			if (cat) {
				props.swm_category_key = key;
				if (!props.swm_icon && cat.icon) props.swm_icon = cat.icon;
				if (!props.swm_color && cat.color) props.swm_color = cat.color;
			}

			// Anche quando il POI ha una sua icona, le dimensioni seguono Elementor:
			// prima dimensione categoria, poi dimensione backend generale.
			if (!props.swm_icon_size) props.swm_icon_size = (cat && cat.iconSize) || config.backendMarkerIconSize || config.markerSize || 24;
			if (!props.swm_label_size) props.swm_label_size = (cat && cat.labelSize) || config.backendLabelFontSize || config.labelFontSize || 12;
			if (props.swm_icon) props.swm_icon_key = iconKeyFromUrl(props.swm_icon);
			return { type: 'Feature', properties: props, geometry: feature.geometry };
		});
	}

	function pointFeaturesFromBackendGeojson(geojson) {
		var points = [];
		if (!geojson) return points;
		function scan(feature) {
			if (!feature || !feature.geometry) return;
			if (feature.geometry.type !== 'Point') return;
			var props = Object.assign({}, feature.properties || {});
			props.swm_source = 'backend';
			props.swm_name = props.swm_name || props.sw_name || props.name || props.title || '';
			points.push({ type: 'Feature', properties: props, geometry: feature.geometry });
		}
		if (geojson.type === 'FeatureCollection') geojson.features.forEach(scan);
		else if (geojson.type === 'Feature') scan(geojson);
		return points;
	}

function addNativeMarkers(map, features, config) {
		features = ensureBackendStyleProps(ensureManualStyleProps(enrichManualCategories(features, config), config), config);

		var source = 'swm-points-source';
		var data = { type: 'FeatureCollection', features: features };
		map.addSource(source, { type: 'geojson', data: data });

		var mapId = map.getContainer().id;
		var geoIconName = imageName('geojson', mapId);
		var manualIconName = imageName('manual', mapId);
		var backendIconName = imageName('backend', mapId);
		var cats = manualCategoryMap(config);
		var categoryKeys = Object.keys(cats).filter(function (key) {
			return !!cats[key].icon;
		});

		var backendIconUrls = {};
		features.forEach(function (feature) {
			if (!feature.properties || feature.properties.swm_source !== 'backend' || !feature.properties.swm_icon || !feature.properties.swm_icon_key) return;
			backendIconUrls[feature.properties.swm_icon_key] = feature.properties.swm_icon;
		});
		var backendIconKeys = Object.keys(backendIconUrls);

		var loadJobs = [
			loadMapImage(map, geoIconName, config.geojsonMarkerSvgUrl),
			loadMapImage(map, manualIconName, config.manualMarkerSvgUrl),
			loadMapImage(map, backendIconName, config.backendMarkerSvgUrl)
		];

		categoryKeys.forEach(function (key) {
			loadJobs.push(loadMapImage(map, 'swm-cat-' + key + '-' + mapId, cats[key].icon));
		});
		backendIconKeys.forEach(function (key) {
			loadJobs.push(loadMapImage(map, 'swm-' + key + '-' + mapId, backendIconUrls[key]));
		});

		Promise.all(loadJobs).then(function (loaded) {
			var clickableLayers = [];

			var geoLoaded = loaded[0];
			var manualLoaded = loaded[1];
			var backendLoaded = loaded[2];

			var categoryLoaded = {};
			categoryKeys.forEach(function (key, index) {
				categoryLoaded[key] = !!loaded[index + 3];
			});

			var backendCustomIconLoaded = {};
			backendIconKeys.forEach(function (key, index) {
				backendCustomIconLoaded[key] = !!loaded[index + 3 + categoryKeys.length];
			});

			var geoFilter = ['==', ['get', 'swm_source'], 'geojson'];
			var manualBaseFilter = ['==', ['get', 'swm_source'], 'manual'];

			if (geoLoaded) {
				addSymbolIconLayer(map, 'swm-points-geojson-icon', source, geoIconName, config, geoFilter);
				clickableLayers.push('swm-points-geojson-icon');
			} else {
				addCircleLayer(map, 'swm-points-geojson-circle', source, config, geoFilter);
				clickableLayers.push('swm-points-geojson-circle');
			}

			var handledCategoryKeys = [];

			categoryKeys.forEach(function (key) {
				if (!categoryLoaded[key]) return;

				var layerId = 'swm-points-manual-cat-' + key;
				var iconName = 'swm-cat-' + key + '-' + mapId;

				addSymbolIconLayer(map, layerId, source, iconName, config, [
					'all',
					manualBaseFilter,
					['==', ['get', 'swm_category_key'], key]
				]);

				clickableLayers.push(layerId);
				handledCategoryKeys.push(key);
			});

			if (manualLoaded) {
				var manualFilter = manualBaseFilter;

				if (handledCategoryKeys.length) {
					manualFilter = [
						'all',
						manualBaseFilter,
						['!', ['in', ['get', 'swm_category_key'], ['literal', handledCategoryKeys]]]
					];
				}

				addSymbolIconLayer(map, 'swm-points-manual-icon', source, manualIconName, config, manualFilter);
				clickableLayers.push('swm-points-manual-icon');
			} else {
				var circleFilter = manualBaseFilter;

				if (handledCategoryKeys.length) {
					circleFilter = [
						'all',
						manualBaseFilter,
						['!', ['in', ['get', 'swm_category_key'], ['literal', handledCategoryKeys]]]
					];
				}

				addCircleLayer(map, 'swm-points-manual-circle', source, config, circleFilter);
				clickableLayers.push('swm-points-manual-circle');
			}


			var backendBaseFilter = ['==', ['get', 'swm_source'], 'backend'];
			var handledBackendKeys = [];
			backendIconKeys.forEach(function (key) {
				if (!backendCustomIconLoaded[key]) return;
				var layerId = 'swm-points-backend-custom-' + key;
				addSymbolIconLayer(map, layerId, source, 'swm-' + key + '-' + mapId, config, [
					'all',
					backendBaseFilter,
					['==', ['get', 'swm_icon_key'], key]
				]);
				clickableLayers.push(layerId);
				handledBackendKeys.push(key);
			});

			var backendFilter = backendBaseFilter;
			if (handledBackendKeys.length) {
				backendFilter = ['all', backendBaseFilter, ['!', ['in', ['get', 'swm_icon_key'], ['literal', handledBackendKeys]]]];
			}

			if (backendLoaded) {
				addSymbolIconLayer(map, 'swm-points-backend-icon', source, backendIconName, config, backendFilter);
				clickableLayers.push('swm-points-backend-icon');
			} else {
				addCircleLayer(map, 'swm-points-backend-circle', source, config, backendFilter);
				clickableLayers.push('swm-points-backend-circle');
			}

			addLabelLayer(map, source, config);
			addPopupHandlers(map, clickableLayers, config);
		});
	}

		function addManualPointsToBounds(config, coords) { parseManualPoints(config).forEach(function (feature) { coords.push(feature.geometry.coordinates); }); }

	function backendPointsUrl(config) {
		var url = config.backendPointsUrl || '';
		if (url && config.backendProjectId) {
			url += (url.indexOf('?') === -1 ? '?' : '&') + 'project_id=' + encodeURIComponent(config.backendProjectId);
		}
		return url;
	}

	function backendRouteUrl(config) {
		var url = config.backendRouteUrl || '';
		if (url && config.backendProjectId) {
			url += (url.indexOf('?') === -1 ? '?' : '&') + 'project_id=' + encodeURIComponent(config.backendProjectId);
		}
		return url;
	}

	function mergeRoutes(primary, secondary) {
		if (primary && !secondary) return primary;
		if (!primary && secondary) return secondary;
		if (!primary && !secondary) return null;
		var features = [];
		function add(g) {
			if (!g) return;
			if (g.type === 'FeatureCollection' && Array.isArray(g.features)) features = features.concat(g.features);
			else if (g.type === 'Feature') features.push(g);
			else if (g.type && g.coordinates) features.push({ type:'Feature', properties:{}, geometry:g });
		}
		add(primary); add(secondary);
		return { type:'FeatureCollection', features:features };
	}

	function fetchJson(url) {
		if (!url) return Promise.resolve(null);

		url = String(url).trim();
		if (!url || url === '0' || url === '[object Object]') {
			console.warn('Wild Maps: URL GeoJSON non valido da dynamic tag:', url);
			return Promise.resolve(null);
		}

		return fetch(url, { cache: 'no-store' }).then(function (response) {
			if (!response.ok) throw new Error('GeoJSON non caricato: ' + response.status + ' - ' + url);
			return response.json();
		});
	}

	function collectGeojsonCoords(geojson, coords) {
		if (!geojson) return;
		if (geojson.type === 'FeatureCollection') geojson.features.forEach(function (feature) { collectCoordinates(feature.geometry, coords); });
		else if (geojson.type === 'Feature') collectCoordinates(geojson.geometry, coords);
		else if (geojson.type && geojson.coordinates) collectCoordinates(geojson, coords);
	}

	function collectInitialCoords(config, routeGeojson, pointsGeojson, backendGeojson) {
		var coords = [];
		collectGeojsonCoords(routeGeojson, coords);
		collectGeojsonCoords(pointsGeojson, coords);
		addManualPointsToBounds(config, coords);
		collectGeojsonCoords(backendGeojson, coords);
		return coords.filter(function (coord) {
			return coord && coord.length >= 2 && !isNaN(parseFloat(coord[0])) && !isNaN(parseFloat(coord[1]));
		});
	}

	function initMap(element) {
		if (!window.maplibregl || !element) return;
		var config = {};
		try { config = JSON.parse(element.getAttribute('data-swm-map') || '{}'); }
		catch (e) { console.error('Wild Maps: config non valida.', e); return; }
		if (!config.apiKey) return;

		var styleUrl = 'https://api.maptiler.com/maps/' + (config.mapStyle || 'outdoor-v2') + '/style.json?key=' + encodeURIComponent(config.apiKey) + '&language=en';
		var dataPromise = Promise.all([
			fetchJson(config.routeGeojsonUrl),
			config.enableBackendRoute ? fetchJson(backendRouteUrl(config)) : Promise.resolve(null),
			fetchJson(config.pointsGeojsonUrl),
			config.enableBackendPoints ? fetchJson(backendPointsUrl(config)) : Promise.resolve(null)
		]);

		dataPromise.then(function (items) {
			var routeGeojson = mergeRoutes(items[0], items[1]);
			var pointsGeojson = items[2];
			var backendGeojson = items[3];
			var coords = collectInitialCoords(config, routeGeojson, pointsGeojson, backendGeojson);
			var initialCenter = (config.autoFit && coords.length > 0) ? coords[0] : (config.center || [12.4964, 41.9028]);
			var initialZoom = (config.autoFit && coords.length > 0) ? Math.max(3, Math.min(parseInt(config.zoom || 7, 10), 8)) : (config.zoom || 5);

			var map = new maplibregl.Map({
				container: element.id,
				style: styleUrl,
				center: initialCenter,
				zoom: initialZoom,
				attributionControl: true
			});
			map.addControl(new maplibregl.NavigationControl(), 'top-right');
			if (config.showFullscreenControl && maplibregl.FullscreenControl) {
				map.addControl(new maplibregl.FullscreenControl(), 'top-right');
			}

			function finish() {
				if (routeGeojson) {
					map.addSource('swm-route-source', { type: 'geojson', data: routeGeojson });
					map.addLayer({
						id: 'swm-route',
						type: 'line',
						source: 'swm-route-source',
						filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
						layout: { 'line-join': 'round', 'line-cap': 'round' },
						paint: { 'line-color': config.routeColor || '#e63b2e', 'line-width': config.routeWidth || 4, 'line-opacity': 0.95 }
					});
				}

				var sourceForPoints = pointsGeojson || routeGeojson;
				var features = pointFeaturesFromGeojson(sourceForPoints, config).concat(parseManualPoints(config)).concat(pointFeaturesFromBackendGeojson(backendGeojson));
				if (features.length) addNativeMarkers(map, features, config);

				if (config.autoFit && coords.length > 0) {
					var bounds = coords.reduce(function (b, coord) { return b.extend(coord); }, new maplibregl.LngLatBounds(coords[0], coords[0]));
					map.fitBounds(bounds, { padding: 70, maxZoom: 10, duration: 0 });
				}
			}

			map.on('load', finish);
		}).catch(function (error) {
			console.error('Wild Maps:', error);
			element.classList.add('swm-map-error');
		});
	}

	function initAll() {
		document.querySelectorAll('.swm-map[data-swm-map]').forEach(function (element) {
			if (element.dataset.swmInitialized === '1') return;
			element.dataset.swmInitialized = '1';
			initMap(element);
		});
	}

	document.addEventListener('DOMContentLoaded', initAll);
	if (window.elementorFrontend && window.elementorFrontend.hooks) window.elementorFrontend.hooks.addAction('frontend/element_ready/staywild_map.default', initAll);
})();
