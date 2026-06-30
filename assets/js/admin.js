(function () {
	'use strict';

	function $(id) { return document.getElementById(id); }
	function val(id, value) { if (typeof value !== 'undefined') { $(id).value = value == null ? '' : value; } return $(id).value; }
	function msg(text, type) { var el = $('swm-admin-message'); if (!el) return; el.textContent = text || ''; el.className = type ? 'is-' + type : ''; }
	function esc(text) { return String(text || '').replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]; }); }
	function toFloat(value) { return parseFloat(String(value || '').replace(',', '.')); }

	function initMediaPickers() {
		if (typeof wp === 'undefined' || !wp.media) return;
		document.querySelectorAll('.swm-select-media').forEach(function (button) {
			button.addEventListener('click', function (e) {
				e.preventDefault();
				var targetId = button.getAttribute('data-target');
				var input = targetId ? document.getElementById(targetId) : null;
				if (!input) return;
				var frame = wp.media({
					title: 'Choose map icon',
					button: { text: 'Use this icon' },
					multiple: false,
					library: { type: ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'] }
				});
				frame.on('select', function () {
					var attachment = frame.state().get('selection').first().toJSON();
					if (attachment && attachment.url) {
						input.value = attachment.url;
						input.dispatchEvent(new Event('change', { bubbles: true }));
					}
				});
				frame.open();
			});
		});
		document.querySelectorAll('.swm-clear-media').forEach(function (button) {
			button.addEventListener('click', function (e) {
				e.preventDefault();
				var targetId = button.getAttribute('data-target');
				var input = targetId ? document.getElementById(targetId) : null;
				if (input) { input.value = ''; input.dispatchEvent(new Event('change', { bubbles: true })); }
			});
		});
	}
	initMediaPickers();

	var mapEl = $('swm-admin-map');
	if (!mapEl) return;
	if (typeof maplibregl === 'undefined') {
		mapEl.innerHTML = '<div class="swm-admin-map-error">Mappa non caricata: libreria MapLibre non disponibile. Controlla che il file JS/CSS venga caricato correttamente.</div>';
		return;
	}
	if (typeof SWM_ADMIN === 'undefined') {
		mapEl.innerHTML = '<div class="swm-admin-map-error">Mappa non caricata: configurazione admin mancante.</div>';
		return;
	}

	var points = [];
	var markers = {};
	var selectedId = '';
	var tempMarker = null;
	var deleteMode = false;
	var deleteModeBtn = null;
	var currentProjectEl = $('swm-current-project');
	function currentProjectId() { return currentProjectEl ? currentProjectEl.value : ''; }

	mapEl.style.visibility = 'hidden';
	var mapRevealed = false;
	var ipCacheKey = 'wild_maps_admin_ip_center_v1';
	function revealAdminMap() {
		if (mapRevealed) return;
		mapRevealed = true;
		mapEl.style.visibility = 'visible';
		setTimeout(function () { try { map.resize(); } catch (e) {} }, 0);
	}
	function getCachedIpCenter() {
		try {
			if (!window.localStorage) return null;
			var cached = localStorage.getItem(ipCacheKey);
			if (!cached) return null;
			var data = JSON.parse(cached);
			if (data && isFinite(Number(data.lat)) && isFinite(Number(data.lng)) && data.expires && Date.now() < data.expires) {
				return { lat: Number(data.lat), lng: Number(data.lng) };
			}
		} catch (e) {}
		return null;
	}
	function saveCachedIpCenter(center) {
		try {
			if (window.localStorage) localStorage.setItem(ipCacheKey, JSON.stringify({ lat: Number(center.lat), lng: Number(center.lng), expires: Date.now() + 86400000 }));
		} catch (e) {}
	}
	var cachedIpCenter = getCachedIpCenter();
	var initialCenter = cachedIpCenter ? [cachedIpCenter.lng, cachedIpCenter.lat] : (SWM_ADMIN.center || [42.72, 43.04]);
	var initialZoom = cachedIpCenter ? (SWM_ADMIN.ipZoom || 8) : (SWM_ADMIN.zoom || 7);

	var adminStyle = SWM_ADMIN.mapStyleUrl || {
		version: 8,
		glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
		sources: {
			'carto-voyager': {
				type: 'raster',
				tiles: [
					'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
					'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
					'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
				],
				tileSize: 256,
				attribution: '© OpenStreetMap contributors © CARTO'
			}
		},
		layers: [{ id: 'carto-voyager', type: 'raster', source: 'carto-voyager' }]
	};

	var map = new maplibregl.Map({
		container: 'swm-admin-map',
		style: adminStyle,
		center: SWM_ADMIN.center || [42.72, 43.04],
		zoom: SWM_ADMIN.zoom || 7,
		preserveDrawingBuffer: true
	});
	map.addControl(new maplibregl.NavigationControl(), 'top-right');

	var hasLoadedProjectBounds = false;
	function markMapContentFitted() { hasLoadedProjectBounds = true; }
	function hasProjectMapContent() {
		return hasLoadedProjectBounds || points.length > 0 || routeWaypoints.length > 0 || !!routeGeojson;
	}
	function centerAdminMapFromIpIfEmpty() {
		if (!SWM_ADMIN.ipCenterEnabled) return Promise.resolve(false);
		if (hasProjectMapContent()) return Promise.resolve(false);
		function applyCenter(center, source) {
			if (!center || !isFinite(Number(center.lng)) || !isFinite(Number(center.lat))) return false;
			if (hasProjectMapContent()) return false;
			map.jumpTo({ center: [Number(center.lng), Number(center.lat)], zoom: SWM_ADMIN.ipZoom || 8 });
			if (source) routeMsg('Mappa centrata in base alla posizione stimata da IP.', 'info');
			return true;
		}
		var cached = getCachedIpCenter();
		if (cached) return Promise.resolve(applyCenter(cached, false));
		var services = [
			{ url: 'https://ipapi.co/json/', parse: function (d) { return { lat: d.latitude, lng: d.longitude }; } },
			{ url: 'https://ipwho.is/', parse: function (d) { return { lat: d.latitude, lng: d.longitude }; } }
		];
		function tryService(index) {
			if (index >= services.length) return Promise.resolve(false);
			return fetch(services[index].url, { credentials: 'omit', cache: 'force-cache' })
				.then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('ip_failed')); })
				.then(function (json) {
					var center = services[index].parse(json || {});
					if (!center || !isFinite(Number(center.lat)) || !isFinite(Number(center.lng))) throw new Error('ip_invalid');
					center = { lat: Number(center.lat), lng: Number(center.lng) };
					saveCachedIpCenter(center);
					return applyCenter(center, true);
				})
				.catch(function () { return tryService(index + 1); });
		}
		return tryService(0);
	}

	function post(action, data) {
		var body = new URLSearchParams(Object.assign({ action: action, nonce: SWM_ADMIN.nonce }, data || {}));
		return fetch(SWM_ADMIN.ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		}).then(function (r) { return r.json(); }).then(function (json) {
			if (!json || !json.success) throw new Error((json && json.data && json.data.message) || 'Errore salvataggio.');
			return json.data;
		});
	}

	function clearTemp() { if (tempMarker) { tempMarker.remove(); tempMarker = null; } }

	var geocodeTimer = null;
	var selectedPlace = null;
	function searchPlaces(text) {
		return post('swm_admin_ors_geocode', { text: text });
	}
	function setPointFromPlace(place) {
		if (!place) return;
		clearTemp();
		resetForm();
		val('swm-point-name', place.name || place.label || 'New POI');
		val('swm-point-lat', Number(place.lat).toFixed(6));
		val('swm-point-lng', Number(place.lng).toFixed(6));
		val('swm-point-project-id', currentProjectId());
		tempMarker = new maplibregl.Marker({ element: markerElement({ name: place.name || place.label || 'New POI' }), draggable: true })
			.setLngLat([Number(place.lng), Number(place.lat)])
			.addTo(map);
		tempMarker.on('dragend', function () {
			var ll = tempMarker.getLngLat();
			val('swm-point-lng', Number(ll.lng.toFixed(6)));
			val('swm-point-lat', Number(ll.lat.toFixed(6)));
		});
		map.easeTo({ center: [Number(place.lng), Number(place.lat)], zoom: Math.max(map.getZoom(), 10), duration: 500 });
		msg('Località aggiunta al form POI. Premi Salva punto.', 'info');
	}
	function addPlaceAsWaypoint(place) {
		if (!place) return;
		if (!currentProjectId()) { routeMsg('Select a project first.', 'error'); return; }
		routeWaypoints.push([Number(place.lng), Number(place.lat), place.name || place.label || '']);
		routeGeojson = null;
		renderRouteMarkers();
		map.easeTo({ center: [Number(place.lng), Number(place.lat)], zoom: Math.max(map.getZoom(), 9), duration: 500 });
		routeMsg('Stop aggiunta da ricerca. Calcola il percorso su strada quando hai almeno 2 tappe.', 'info');
	}
	function renderPlaceResults(results) {
		var wrap = $('swm-place-results');
		if (!wrap) return;
		if (!results || !results.length) { wrap.innerHTML = '<p>Nessun suggerimento.</p>'; return; }
		wrap.innerHTML = results.map(function (place, index) {
			var label = esc(place.label || place.name || 'Località');
			return '<div class="swm-place-result" data-index="' + index + '"><button type="button" class="swm-place-title">' + label + '</button><div class="swm-place-actions"><button type="button" class="button swm-place-point">Add as POI</button><button type="button" class="button swm-place-waypoint">Add as stop</button></div></div>';
		}).join('');
		wrap.querySelectorAll('.swm-place-result').forEach(function (row) {
			var place = results[Number(row.getAttribute('data-index'))];
			row.querySelector('.swm-place-title').addEventListener('click', function () { selectedPlace = place; setPointFromPlace(place); });
			row.querySelector('.swm-place-point').addEventListener('click', function () { selectedPlace = place; setPointFromPlace(place); });
			row.querySelector('.swm-place-waypoint').addEventListener('click', function () { selectedPlace = place; addPlaceAsWaypoint(place); });
		});
	}
	function runPlaceSearch() {
		var input = $('swm-place-search');
		var wrap = $('swm-place-results');
		if (!input) return;
		var text = input.value.trim();
		selectedPlace = null;
		clearTimeout(geocodeTimer);
		if (text.length < 2) { renderPlaceResults([]); return; }
		if (wrap) wrap.innerHTML = '<p>Ricerca località...</p>';
		searchPlaces(text).then(function (data) {
			renderPlaceResults(data.results || []);
		}).catch(function (e) {
			if (wrap) wrap.innerHTML = '<p class="is-error">' + esc(e.message) + '</p>';
		});
	}
	function initPlaceSearch() {
		var input = $('swm-place-search');
		var clear = $('swm-place-clear');
		var submit = $('swm-place-submit');
		if (!input) return;
		input.addEventListener('input', function () {
			clearTimeout(geocodeTimer);
			geocodeTimer = setTimeout(runPlaceSearch, 350);
		});
		input.addEventListener('keydown', function (e) {
			if (e.key === 'Enter') { e.preventDefault(); runPlaceSearch(); }
		});
		if (submit) submit.addEventListener('click', function (e) { e.preventDefault(); runPlaceSearch(); });
		if (clear) clear.addEventListener('click', function (e) { e.preventDefault(); input.value = ''; renderPlaceResults([]); input.focus(); });
	}


	function resetForm() {
		selectedId = '';
		$('swm-form-title').textContent = 'New POI';
		['swm-point-id','swm-point-project-id','swm-point-name','swm-point-lat','swm-point-lng','swm-point-category','swm-point-icon','swm-point-description'].forEach(function (id) { val(id, ''); });
		val('swm-point-label', '1');
		val('swm-point-order', '0');
		val('swm-point-project-id', currentProjectId());
		$('swm-delete-point').style.display = 'none';
		clearTemp();
		msg('');
	}

	function fillForm(point) {
		selectedId = point.id || '';
		$('swm-form-title').textContent = selectedId ? 'Modifica POI' : 'New POI';
		val('swm-point-id', selectedId);
		val('swm-point-project-id', point.project_id || currentProjectId());
		val('swm-point-name', point.name || '');
		val('swm-point-lat', point.lat || '');
		val('swm-point-lng', point.lng || '');
		val('swm-point-category', point.category || '');
		val('swm-point-icon', point.icon_url || '');
		val('swm-point-label', point.label === '0' ? '0' : '1');
		val('swm-point-description', point.description || '');
		val('swm-point-order', point.order || 0);
		$('swm-delete-point').style.display = selectedId ? '' : 'none';
	}

	function markerElement(point) {
		var el = document.createElement('button');
		el.type = 'button';
		el.className = 'swm-admin-marker';
		el.title = point.name || 'Punto';
		el.innerHTML = '<span></span>';
		return el;
	}


	function deleteSavedPointFromMap(point) {
		if (!point || !point.id) return;
		var label = point.name ? '"' + point.name + '"' : 'questo punto';
		if (!confirm('Eliminare ' + label + ' dalla mappa?')) return;
		post('swm_admin_delete_point', { id: point.id, project_id: currentProjectId() }).then(function (res) {
			points = res.points || [];
			resetForm();
			renderMarkers();
			renderList();
			msg('Punto eliminato dalla mappa.', 'success');
		}).catch(function (e) { msg(e.message, 'error'); });
	}

	function renderMarkers() {
		Object.keys(markers).forEach(function (id) { markers[id].remove(); });
		markers = {};
		points.forEach(function (point) {
			if (!point.lat || !point.lng) return;
			var marker = new maplibregl.Marker({ element: markerElement(point), draggable: true })
				.setLngLat([Number(point.lng), Number(point.lat)])
				.addTo(map);
			marker.getElement().addEventListener('click', function (event) {
				event.stopPropagation();
				if (deleteMode) { deleteSavedPointFromMap(point); return; }
				clearTemp();
				fillForm(point);
				map.easeTo({ center: [Number(point.lng), Number(point.lat)], duration: 500 });
			});
			marker.getElement().addEventListener('contextmenu', function (event) {
				event.preventDefault();
				event.stopPropagation();
				deleteSavedPointFromMap(point);
			});
			marker.on('dragend', function () {
				var ll = marker.getLngLat();
				point.lng = Number(ll.lng.toFixed(6));
				point.lat = Number(ll.lat.toFixed(6));
				fillForm(point);
				msg('Coordinate aggiornate. Premi Salva punto per memorizzarle.', 'info');
			});
			markers[point.id] = marker;
		});
	}

	function renderList() {
		var wrap = $('swm-points-list');
		if (!points.length) { wrap.innerHTML = '<p>Nessun punto salvato. Clicca sulla mappa per iniziare.</p>'; return; }
		wrap.innerHTML = '<table class="widefat striped"><thead><tr><th>Nome</th><th>Categoria</th><th>Lat</th><th>Lng</th></tr></thead><tbody>' + points.map(function (p) {
			return '<tr data-id="' + p.id + '"><td><button type="button" class="button-link swm-row-select">' + esc(p.name) + '</button></td><td>' + esc(p.category) + '</td><td>' + esc(p.lat) + '</td><td>' + esc(p.lng) + '</td></tr>';
		}).join('') + '</tbody></table>';
		wrap.querySelectorAll('tr[data-id]').forEach(function (row) {
			row.addEventListener('click', function () {
				var point = points.find(function (p) { return String(p.id) === String(row.getAttribute('data-id')); });
				if (!point) return;
				clearTemp();
				fillForm(point);
				map.easeTo({ center: [Number(point.lng), Number(point.lat)], zoom: Math.max(map.getZoom(), 9), duration: 700 });
			});
		});
	}

	function loadPoints() {
		return post('swm_admin_list_points', { project_id: currentProjectId() }).then(function (data) {
			points = data.points || [];
			renderMarkers();
			renderList();
			if (points.length) {
				var bounds = new maplibregl.LngLatBounds();
				points.forEach(function (p) { if (p.lat && p.lng) bounds.extend([Number(p.lng), Number(p.lat)]); });
				if (!bounds.isEmpty()) { map.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 0 }); markMapContentFitted(); }
			}
		}).catch(function (e) { msg(e.message, 'error'); });
	}

	map.on('click', function (event) {
		if (deleteMode) return;
		if (typeof routeMode !== 'undefined' && routeMode) return;
		resetForm();
		var lng = Number(event.lngLat.lng.toFixed(6));
		var lat = Number(event.lngLat.lat.toFixed(6));
		val('swm-point-lng', lng);
		val('swm-point-lat', lat);
		tempMarker = new maplibregl.Marker({ element: markerElement({ name: 'New POI' }), draggable: true })
			.setLngLat([lng, lat])
			.addTo(map);
		tempMarker.on('dragend', function () {
			var ll = tempMarker.getLngLat();
			val('swm-point-lng', Number(ll.lng.toFixed(6)));
			val('swm-point-lat', Number(ll.lat.toFixed(6)));
		});
		msg('New POI impostato. Dai un nome e salva.', 'info');
	});

	$('swm-new-point').addEventListener('click', function (e) { e.preventDefault(); resetForm(); });
	$('swm-save-point').addEventListener('click', function (e) {
		e.preventDefault();
		var data = {
			id: val('swm-point-id'),
			name: val('swm-point-name'),
			lat: val('swm-point-lat'),
			lng: val('swm-point-lng'),
			category: val('swm-point-category'),
			icon_url: val('swm-point-icon'),
			label: val('swm-point-label'),
			description: val('swm-point-description'),
			order: val('swm-point-order'),
			project_id: val('swm-point-project-id') || currentProjectId()
		};
		if (!data.name || isNaN(toFloat(data.lat)) || isNaN(toFloat(data.lng))) { msg('Compila nome, latitudine e longitudine.', 'error'); return; }
		post('swm_admin_save_point', data).then(function (res) {
			points = res.points || [];
			clearTemp();
			renderMarkers();
			renderList();
			fillForm(res.point);
			msg('POI salvato.', 'success');
		}).catch(function (e) { msg(e.message, 'error'); });
	});
	$('swm-delete-point').addEventListener('click', function (e) {
		e.preventDefault();
		if (!selectedId) return;
		var point = points.find(function (p) { return String(p.id) === String(selectedId); }) || { id: selectedId, name: val('swm-point-name') };
		deleteSavedPointFromMap(point);
	});



	/* Percorso backend agganciato alle strade - OpenRouteService */
	var routeMode = false;
	var routeWaypoints = [];
	var routeMarkers = [];
	var routeGeojson = null;
	var routeModeBtn = $('swm-route-mode');
	var routeProfileEl = $('swm-route-profile');
	var routeStatusEl = $('swm-route-status');
	var routeLayerDeleteBound = false;
	deleteModeBtn = $('swm-map-delete-mode');
	function routeMsg(text, type) { if (!routeStatusEl) return; routeStatusEl.textContent = text || ''; routeStatusEl.className = type ? 'is-' + type : ''; }
	function routePost(action, data) { return post(action, data); }
	function normalizeRouteSteps() {
		routeWaypoints = (Array.isArray(routeWaypoints) ? routeWaypoints : []).map(function (w, i) {
			if (!Array.isArray(w)) return null;
			var lng = Number(w[0]);
			var lat = Number(w[1]);
			if (!isFinite(lng) || !isFinite(lat)) return null;
			var name = String(w[2] || '').trim() || ('Stop ' + (i + 1));
			return [Number(lng.toFixed(6)), Number(lat.toFixed(6)), name];
		}).filter(Boolean);
	}
	function saveRouteStepsOnly(successMessage) {
		if (!currentProjectId()) { routeMsg('Select a project first.', 'error'); return Promise.reject(new Error('missing_project')); }
		normalizeRouteSteps();
		renderRouteMarkers();
		return routePost('swm_admin_save_route', {
			project_id: currentProjectId(),
			route: routeGeojson ? JSON.stringify(routeGeojson) : '',
			waypoints: JSON.stringify(routeWaypoints),
			allow_empty_route: routeGeojson ? '' : '1'
		}).then(function(){
			routeMsg(successMessage || 'Elenco tappe salvato.', 'success');
		});
	}
	function persistRouteDraft(message) {
		if (!currentProjectId()) return;
		normalizeRouteSteps();
		routePost('swm_admin_save_route', {
			project_id: currentProjectId(),
			route: routeGeojson ? JSON.stringify(routeGeojson) : '',
			waypoints: JSON.stringify(routeWaypoints),
			allow_empty_route: routeGeojson ? '' : '1'
		}).then(function () {
			if (message) routeMsg(message, 'success');
		}).catch(function(e){ routeMsg(e.message, 'error'); });
	}
	function routeMarkerElement(index) {
		var el = document.createElement('button');
		el.type = 'button';
		el.className = 'swm-admin-route-marker';
		el.textContent = String(index + 1);
		el.title = 'Stop ' + (index + 1) + ' - clic in modalità elimina o tasto destro per rimuovere';
		return el;
	}
	function renderRouteLine() {
		if (!map.getSource('swm-admin-route')) {
			map.addSource('swm-admin-route', { type: 'geojson', data: { type:'FeatureCollection', features:[] } });
			map.addLayer({ id:'swm-admin-route-line', type:'line', source:'swm-admin-route', layout:{ 'line-join':'round', 'line-cap':'round' }, paint:{ 'line-color':'#e63b2e', 'line-width':4, 'line-opacity':0.95 } });
		}
		if (!map.getSource('swm-admin-route-waypoints')) {
			map.addSource('swm-admin-route-waypoints', { type: 'geojson', data: { type:'FeatureCollection', features:[] } });
			map.addLayer({ id:'swm-admin-route-waypoint-circles', type:'circle', source:'swm-admin-route-waypoints', paint:{ 'circle-radius':12, 'circle-color':'#111', 'circle-stroke-color':'#fff', 'circle-stroke-width':2 } });
			map.addLayer({ id:'swm-admin-route-waypoint-labels', type:'symbol', source:'swm-admin-route-waypoints', layout:{ 'text-field':['get','label'], 'text-size':12, 'text-font':['Open Sans Bold','Arial Unicode MS Bold'], 'text-allow-overlap':true }, paint:{ 'text-color':'#fff' } });
		}
		if (!routeLayerDeleteBound) {
			routeLayerDeleteBound = true;
			map.on('click', 'swm-admin-route-waypoint-circles', function (event) {
				if (!deleteMode || !event.features || !event.features.length) return;
				event.preventDefault();
				var idx = Number(event.features[0].properties.index);
				removeRouteWaypoint(idx, true, true);
			});
			map.on('mouseenter', 'swm-admin-route-waypoint-circles', function () { if (deleteMode) map.getCanvas().style.cursor = 'crosshair'; });
			map.on('mouseleave', 'swm-admin-route-waypoint-circles', function () { map.getCanvas().style.cursor = ''; });
		}
		var cleanCoords = routeWaypoints.map(function(c){ return [Number(c[0]), Number(c[1])]; });
		var data = routeGeojson || { type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates: cleanCoords } };
		map.getSource('swm-admin-route').setData(data);
		map.getSource('swm-admin-route-waypoints').setData({ type:'FeatureCollection', features: routeWaypoints.map(function(c, i){ return { type:'Feature', properties:{ label:String(i + 1), index:i }, geometry:{ type:'Point', coordinates:[Number(c[0]), Number(c[1])] } }; }) });
	}
	function routeWaypointName(index) {
		var w = routeWaypoints[index] || [];
		return String(w[2] || '').trim() || ('Stop ' + (index + 1));
	}
	function invalidateRouteAfterWaypointEdit(message) {
		routeGeojson = null;
		renderRouteMarkers();
		routeMsg(message || 'Stops changed. Recalculate and save the route.', 'info');
	}
	function swapRouteWaypoints(a, b) {
		if (a < 0 || b < 0 || a >= routeWaypoints.length || b >= routeWaypoints.length) return;
		var tmp = routeWaypoints[a]; routeWaypoints[a] = routeWaypoints[b]; routeWaypoints[b] = tmp;
		invalidateRouteAfterWaypointEdit('Stops reordered. Recalculate and save the route.');
	}
	function renderRouteWaypointList() {
		var list = $('swm-route-waypoints-list');
		if (!list) return;
		if (!routeWaypoints.length) { list.innerHTML = '<li class="swm-route-empty">No stops yet. Enable Route mode and click the map, or search a place and add it as a stop.</li>'; return; }
		list.innerHTML = routeWaypoints.map(function (coord, index) {
			var lng = Number(coord[0]);
			var lat = Number(coord[1]);
			var name = coord[2] || '';
			return '<li class="swm-route-waypoint-row" draggable="true" data-index="' + index + '">' +
				'<span class="swm-route-drag" title="Trascina per riordinare">☰</span>' +
				'<span class="swm-route-number">' + (index + 1) + '</span>' +
				'<div class="swm-route-waypoint-main">' +
					'<input type="text" class="regular-text swm-route-name" value="' + esc(name) + '" placeholder="Stop name" />' +
					'<code>' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</code>' +
					'<div class="swm-route-waypoint-actions">' +
						'<button type="button" class="button-link swm-route-zoom">centra</button>' +
						'<button type="button" class="button-link swm-route-up">su</button>' +
						'<button type="button" class="button-link swm-route-down">giù</button>' +
						'<button type="button" class="button-link-delete swm-route-remove">rimuovi</button>' +
					'</div>' +
				'</div>' +
			'</li>';
		}).join('');
		var dragFrom = null;
		list.querySelectorAll('li[data-index]').forEach(function (row) {
			var index = Number(row.getAttribute('data-index'));
			var nameInput = row.querySelector('.swm-route-name');
			var up = row.querySelector('.swm-route-up');
			var down = row.querySelector('.swm-route-down');
			var remove = row.querySelector('.swm-route-remove');
			var zoom = row.querySelector('.swm-route-zoom');
			if (nameInput) {
				nameInput.addEventListener('input', function () { routeWaypoints[index][2] = nameInput.value; renderRouteLine(); });
				nameInput.addEventListener('change', function () { routeMsg('Stop name aggiornato. Salva elenco tappe o salva il percorso.', 'info'); });
			}
			if (zoom) zoom.addEventListener('click', function () { map.flyTo({ center: [Number(routeWaypoints[index][0]), Number(routeWaypoints[index][1])], zoom: 12, duration: 400 }); });
			if (up) up.addEventListener('click', function () { swapRouteWaypoints(index, index - 1); });
			if (down) down.addEventListener('click', function () { swapRouteWaypoints(index, index + 1); });
			if (remove) remove.addEventListener('click', function () { removeRouteWaypoint(index, false, true); });
			row.addEventListener('dragstart', function (event) { dragFrom = index; row.classList.add('is-dragging'); if (event.dataTransfer) event.dataTransfer.setData('text/plain', String(index)); });
			row.addEventListener('dragend', function () { row.classList.remove('is-dragging'); });
			row.addEventListener('dragover', function (event) { event.preventDefault(); row.classList.add('is-drag-over'); });
			row.addEventListener('dragleave', function () { row.classList.remove('is-drag-over'); });
			row.addEventListener('drop', function (event) {
				event.preventDefault(); row.classList.remove('is-drag-over');
				var from = dragFrom;
				if (event.dataTransfer && event.dataTransfer.getData('text/plain') !== '') from = Number(event.dataTransfer.getData('text/plain'));
				var to = index;
				if (from === null || from === to || from < 0 || from >= routeWaypoints.length) return;
				var item = routeWaypoints.splice(from, 1)[0];
				routeWaypoints.splice(to, 0, item);
				invalidateRouteAfterWaypointEdit('Stops reordered with drag & drop. Recalculate and save the route.');
			});
		});
	}

	function removeRouteWaypoint(index, fromMap, saveNow) {
		if (index < 0 || index >= routeWaypoints.length) return;
		var name = routeWaypoints[index] && routeWaypoints[index][2] ? routeWaypoints[index][2] : 'Stop ' + (index + 1);
		if (fromMap && !confirm('Eliminare ' + name + ' dal percorso?')) return;
		routeWaypoints.splice(index, 1);
		routeGeojson = null;
		renderRouteMarkers();
		if (saveNow || fromMap) {
			persistRouteDraft('Stop eliminata. Percorso stradale svuotato: ricalcola e salva il nuovo percorso.');
		} else {
			routeMsg('Stop rimossa. Ricalcola il percorso e salva.', 'info');
		}
	}

	function renderRouteMarkers() {
		routeMarkers.forEach(function (m) { m.remove(); });
		routeMarkers = [];
		routeWaypoints.forEach(function (coord, index) {
			var marker = new maplibregl.Marker({ element: routeMarkerElement(index), draggable: true })
				.setLngLat([Number(coord[0]), Number(coord[1])]).addTo(map);
			marker.getElement().addEventListener('click', function (event) {
				event.stopPropagation();
				if (deleteMode) { removeRouteWaypoint(index, true, true); }
			});
			marker.getElement().addEventListener('contextmenu', function (event) {
				event.preventDefault();
				event.stopPropagation();
				removeRouteWaypoint(index, true, true);
			});
			marker.on('dragend', function () {
				var ll = marker.getLngLat();
				routeWaypoints[index] = [Number(ll.lng.toFixed(6)), Number(ll.lat.toFixed(6)), routeWaypoints[index] ? (routeWaypoints[index][2] || '') : ''];
				routeGeojson = null;
				renderRouteLine();
				routeMsg('Stop spostata. Ricalcola il percorso su strada e salva.', 'info');
			});
			routeMarkers.push(marker);
		});
		renderRouteLine();
		renderRouteWaypointList();
	}
	function loadRoute() {
		var pid = currentProjectId();
		if (!pid) { routeWaypoints = []; routeGeojson = null; renderRouteMarkers(); routeMsg('Select a project to load/save the route.', 'info'); return Promise.resolve(); }
		return routePost('swm_admin_get_route', { project_id: pid }).then(function (data) {
			routeGeojson = data.route || null;
			routeWaypoints = Array.isArray(data.waypoints) ? data.waypoints : [];
			normalizeRouteSteps();
			renderRouteMarkers();
			if (routeGeojson) {
				var coords = [];
				collectCoordinatesFromGeojson(routeGeojson, coords);
				if (coords.length) {
					var b = new maplibregl.LngLatBounds(coords[0], coords[0]);
					coords.forEach(function(c){ b.extend(c); });
					map.fitBounds(b, { padding:80, maxZoom:10, duration:0 }); markMapContentFitted();
				}
				routeMsg('Percorso progetto caricato.', 'success');
			} else {
				routeMsg('Nessun percorso salvato per questo progetto.', 'info');
			}
		}).catch(function(e){ routeMsg(e.message, 'error'); });
	}
	function collectCoordinatesFromGeojson(geojson, out) {
		function scanGeom(g) {
			if (!g) return;
			if (g.type === 'LineString') g.coordinates.forEach(function(c){ out.push(c); });
			else if (g.type === 'MultiLineString') g.coordinates.forEach(function(line){ line.forEach(function(c){ out.push(c); }); });
			else if (g.type === 'GeometryCollection') g.geometries.forEach(scanGeom);
		}
		if (geojson.type === 'FeatureCollection') geojson.features.forEach(function(f){ scanGeom(f.geometry); });
		else if (geojson.type === 'Feature') scanGeom(geojson.geometry);
		else scanGeom(geojson);
	}

	if (deleteModeBtn) {
		deleteModeBtn.addEventListener('click', function(e){
			e.preventDefault();
			deleteMode = !deleteMode;
			deleteModeBtn.textContent = 'Modalità elimina: ' + (deleteMode ? 'ON' : 'OFF');
			deleteModeBtn.classList.toggle('button-primary', deleteMode);
			mapEl.classList.toggle('is-delete-mode', deleteMode);
			msg(deleteMode ? 'Modalità elimina attiva: clicca un punto sulla mappa per eliminarlo.' : '', deleteMode ? 'info' : '');
			routeMsg(deleteMode ? 'Modalità elimina attiva: clicca una tappa percorso per rimuoverla.' : '', deleteMode ? 'info' : '');
		});
	}

	if (routeModeBtn) {
		routeModeBtn.addEventListener('click', function(e){
			e.preventDefault();
			routeMode = !routeMode;
			routeModeBtn.textContent = 'Modalità percorso: ' + (routeMode ? 'ON' : 'OFF');
			routeModeBtn.classList.toggle('button-primary', routeMode);
			routeMsg(routeMode ? 'Clicca sulla mappa per aggiungere tappe percorso.' : 'Modalità percorso disattivata.', 'info');
		});
	}
	map.on('click', function(event) {
		if (deleteMode) return;
		if (!routeMode) return;
		if (!currentProjectId()) { routeMsg('Select a project first.', 'error'); return; }
		var defaultName = 'Stop ' + (routeWaypoints.length + 1);
		var waypointName = window.prompt('Stop name', defaultName);
		if (waypointName === null) waypointName = defaultName;
		waypointName = String(waypointName || defaultName).trim();
		routeWaypoints.push([Number(event.lngLat.lng.toFixed(6)), Number(event.lngLat.lat.toFixed(6)), waypointName]);
		routeGeojson = null;
		renderRouteMarkers();
		routeMsg('Stop aggiunta. Quando hai almeno 2 tappe, calcola il percorso su strada.', 'info');
	});
	var calcBtn = $('swm-route-calc');
	if (calcBtn) calcBtn.addEventListener('click', function(e){
		e.preventDefault();
		if (routeWaypoints.length < 2) { routeMsg('At least 2 stops are required.', 'error'); return; }
		routeMsg('Calcolo percorso OpenRouteService...', 'info');
		routePost('swm_admin_ors_route', { profile: routeProfileEl ? routeProfileEl.value : 'driving-car', coordinates: JSON.stringify(routeWaypoints.map(function(c){ return [Number(c[0]), Number(c[1])]; })) }).then(function(data){
			routeGeojson = data.route || null;
			renderRouteLine();
			routeMsg('Percorso su strada calcolato. Ora puoi salvarlo nel progetto.', 'success');
		}).catch(function(e){ routeMsg(e.message, 'error'); });
	});
	var saveRouteBtn = $('swm-route-save');
	if (saveRouteBtn) saveRouteBtn.addEventListener('click', function(e){
		e.preventDefault();
		if (!currentProjectId()) { routeMsg('Select a project first.', 'error'); return; }
		if (!routeGeojson) { routeMsg('Calcola prima il percorso su strada.', 'error'); return; }
		normalizeRouteSteps();
		routePost('swm_admin_save_route', { project_id: currentProjectId(), route: JSON.stringify(routeGeojson), waypoints: JSON.stringify(routeWaypoints) }).then(function(){
			routeMsg('Route saved in the project.', 'success');
		}).catch(function(e){ routeMsg(e.message, 'error'); });
	});
	var undoBtn = $('swm-route-undo');
	if (undoBtn) undoBtn.addEventListener('click', function(e){ e.preventDefault(); if (!routeWaypoints.length) return; routeWaypoints.pop(); routeGeojson = null; renderRouteMarkers(); persistRouteDraft('Ultima tappa eliminata. Road route cleared: recalculate and save.'); });
	var clearBtn = $('swm-route-clear');
	if (clearBtn) clearBtn.addEventListener('click', function(e){ e.preventDefault(); if (!confirm('Clear current route and stops?')) return; routeWaypoints = []; routeGeojson = null; renderRouteMarkers(); persistRouteDraft('Route and stops cleared.'); });
	var reverseBtn = $('swm-route-reverse');
	if (reverseBtn) reverseBtn.addEventListener('click', function(e){
		e.preventDefault();
		if (routeWaypoints.length < 2) { routeMsg('At least 2 stops are required to reverse.', 'error'); return; }
		normalizeRouteSteps();
		routeWaypoints.reverse();
		routeGeojson = null;
		renderRouteMarkers();
		saveRouteStepsOnly('Ordine tappe invertito e salvato. Ricalcola il percorso su strada.').catch(function(){});
	});
	var saveListBtn = $('swm-route-save-list');
	if (saveListBtn) saveListBtn.addEventListener('click', function(e){
		e.preventDefault();
		saveRouteStepsOnly('Elenco tappe salvato. Se hai modificato ordine o coordinate, ricalcola il percorso.').catch(function(){});
	});

	function captureRouteSnapshot(callback) {
		try {
			if (!routeGeojson) { callback && callback(); return; }
			var coords = [];
			collectCoordinatesFromGeojson(routeGeojson, coords);
			if (coords.length) {
				var b = new maplibregl.LngLatBounds(coords[0], coords[0]);
				coords.forEach(function(c){ b.extend(c); });
				map.fitBounds(b, { padding:70, maxZoom:10, duration:0 });
			}
			map.once('idle', function () {
				setTimeout(function(){
					try {
						var data = map.getCanvas().toDataURL('image/png');
						if (window.localStorage && currentProjectId()) localStorage.setItem('swm_route_snapshot_' + currentProjectId(), data);
					} catch (err) { routeMsg('Snapshot mappa non disponibile: uso mappa semplificata nel roadbook.', 'info'); }
					callback && callback();
				}, 250);
			});
		} catch(e) { callback && callback(); }
	}
	var pdfBtn = $('swm-route-pdf');
	if (pdfBtn) pdfBtn.addEventListener('click', function(e){
		e.preventDefault();
		if (!currentProjectId()) { routeMsg('Select a project first.', 'error'); return; }
		if (!routeGeojson) { routeMsg('Salva prima un percorso calcolato per generare le indicazioni.', 'error'); return; }
		var url = SWM_ADMIN.ajaxUrl + '?action=swm_admin_route_pdf&project_id=' + encodeURIComponent(currentProjectId()) + '&nonce=' + encodeURIComponent(SWM_ADMIN.nonce);
		routeMsg('Creo snapshot della mappa reale...', 'info');
		captureRouteSnapshot(function(){ window.open(url, '_blank'); routeMsg('Roadbook aperto. Usa Stampa / Salva PDF.', 'success'); });
	});

	function loadCurrentProject() {
		hasLoadedProjectBounds = false;
		return Promise.all([loadPoints(), loadRoute()]).then(function () {
			return centerAdminMapFromIpIfEmpty();
		}).then(function () {
			revealAdminMap();
		}).catch(function () {
			revealAdminMap();
		});
	}
	if (currentProjectEl) { currentProjectEl.addEventListener('change', function () { resetForm(); loadCurrentProject(); }); }
	initPlaceSearch();
	map.on('load', function(){ loadCurrentProject(); });
})();

// v1.0.0 - Wild Maps Studio UX helpers
(function () {
	'use strict';
	function byId(id) { return document.getElementById(id); }
	function clickProxy(targetId) {
		var target = targetId ? byId(targetId) : null;
		if (target && !target.disabled) target.click();
	}
	document.querySelectorAll('.swm-studio-topbar [data-swm-proxy]').forEach(function (button) {
		button.addEventListener('click', function (e) {
			var targetId = button.getAttribute('data-swm-proxy');
			if (!targetId) return;
			e.preventDefault();
			clickProxy(targetId);
		});
	});
	document.querySelectorAll('.swm-studio-tabs [data-swm-tab]').forEach(function (tab) {
		tab.addEventListener('click', function () {
			var key = tab.getAttribute('data-swm-tab');
			document.querySelectorAll('.swm-studio-tabs [data-swm-tab]').forEach(function (t) { t.classList.toggle('is-active', t === tab); });
			document.querySelectorAll('.swm-tab-panel[data-swm-panel]').forEach(function (panel) { panel.classList.toggle('is-active', panel.getAttribute('data-swm-panel') === key); });
			if (key === 'poi') setTimeout(function(){ var list = byId('swm-points-list'); if (list) list.scrollIntoView({ block: 'nearest' }); }, 10);
			if (window.maplibregl) setTimeout(function(){ window.dispatchEvent(new Event('resize')); }, 60);
		});
	});
	document.querySelectorAll('.swm-studio-toolbar [data-swm-tool]').forEach(function (tool) {
		tool.addEventListener('click', function () {
			if (tool.disabled) return;
			document.querySelectorAll('.swm-studio-toolbar [data-swm-tool]').forEach(function (t) { t.classList.toggle('is-active', t === tool); });
			var proxy = tool.getAttribute('data-swm-proxy');
			if (proxy) clickProxy(proxy);
		});
	});
})();
