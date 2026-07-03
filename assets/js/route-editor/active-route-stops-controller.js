(function (window, document) {
	'use strict';

	var BLOCKED_CLICK_IDS = {
		'swm-route-calc': true,
		'swm-route-save': true,
		'swm-route-undo': true,
		'swm-route-reverse': true,
		'swm-route-save-list': true,
		'swm-route-clear': true
	};

	var originalAddEventListener = EventTarget.prototype.addEventListener;
	if (!window.__swmActiveRouteStopsPatched) {
		window.__swmActiveRouteStopsPatched = true;
		EventTarget.prototype.addEventListener = function (type, listener, options) {
			try {
				if (type === 'click' && this && this.id && BLOCKED_CLICK_IDS[this.id] && !listener.__swmActiveRouteStops) return;
			} catch (e) {}
			return originalAddEventListener.call(this, type, listener, options);
		};
	}

	function byId(id) { return document.getElementById(id); }
	function store() { return window.WildMapsRouteEditorStore || null; }
	function status(text, type) { var el = byId('swm-route-status'); if (!el) return; el.textContent = text || ''; el.className = type ? 'is-' + type : ''; }
	function currentProjectId() { var el = byId('swm-current-project'); return el ? el.value : ''; }
	function emptyFc() { return { type: 'FeatureCollection', features: [] }; }
	function esc(text) { return String(text || '').replace(/[&<>"']/g, function (m) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[m]; }); }
	function mark(fn) { fn.__swmActiveRouteStops = true; return fn; }
	function post(action, data) {
		var body = new URLSearchParams(Object.assign({ action: action, nonce: window.SWM_ADMIN ? window.SWM_ADMIN.nonce : '' }, data || {}));
		return fetch(window.SWM_ADMIN.ajaxUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: body.toString() }).then(function (r) { return r.json(); }).then(function (json) {
			if (!json || !json.success) throw new Error((json && json.data && json.data.message) || 'Route error.');
			return json.data;
		});
	}
	function state() { var s = store(); return s && s.getState ? s.getState() : { routes: [], activeRouteId: '' }; }
	function activeRoute() { var st = state(); return (st.routes || []).find(function (route) { return route.id === st.activeRouteId; }) || null; }
	function updateActiveRoute(patch) {
		var s = store();
		if (!s || !s.getState || !s.load) return false;
		var st = s.getState();
		var id = st.activeRouteId || ((st.routes || [])[0] && st.routes[0].id) || '';
		if (!id) return false;
		var changed = false;
		var routes = (st.routes || []).map(function (route) {
			if (route.id !== id) return route;
			changed = true;
			return Object.assign({}, route, patch || {});
		});
		if (!changed) return false;
		s.load({ routes: routes, activeRouteId: id });
		return true;
	}
	function saveCollection(message) {
		var s = store();
		var st = state();
		if (!currentProjectId()) { status('Select a project first.', 'error'); return Promise.reject(new Error('missing_project')); }
		if (!st.activeRouteId || !(st.routes || []).length) { status('Create or select a route first.', 'error'); return Promise.reject(new Error('missing_route')); }
		return post('swm_admin_save_routes', { project_id: currentProjectId(), active_route_id: st.activeRouteId, routes: JSON.stringify(st.routes || []) }).then(function (data) {
			if (s && s.load) s.load({ routes: data.routes || st.routes || [], activeRouteId: data.active_route_id || st.activeRouteId || '' });
			status(message || 'Route saved in the project.', 'success');
			return data;
		}).catch(function (e) { status(e.message, 'error'); throw e; });
	}
	function ensureLegacyLayers(map) {
		if (!map || !map.isStyleLoaded || !map.isStyleLoaded()) return false;
		if (!map.getSource('swm-admin-route')) map.addSource('swm-admin-route', { type: 'geojson', data: emptyFc() });
		if (!map.getLayer('swm-admin-route-line')) map.addLayer({ id:'swm-admin-route-line', type:'line', source:'swm-admin-route', layout:{ 'line-join':'round', 'line-cap':'round' }, paint:{ 'line-color':['coalesce',['get','color'],'#e63b2e'], 'line-width':['coalesce',['get','width'],4], 'line-opacity':['coalesce',['get','opacity'],0.95] } });
		if (!map.getSource('swm-admin-route-waypoints')) map.addSource('swm-admin-route-waypoints', { type:'geojson', data: emptyFc() });
		if (!map.getLayer('swm-admin-route-waypoint-circles')) map.addLayer({ id:'swm-admin-route-waypoint-circles', type:'circle', source:'swm-admin-route-waypoints', paint:{ 'circle-radius':12, 'circle-color':'#111', 'circle-stroke-color':'#fff', 'circle-stroke-width':2 } });
		if (!map.getLayer('swm-admin-route-waypoint-labels')) map.addLayer({ id:'swm-admin-route-waypoint-labels', type:'symbol', source:'swm-admin-route-waypoints', layout:{ 'text-field':['get','label'], 'text-size':12, 'text-allow-overlap':true }, paint:{ 'text-color':'#fff' } });
		return true;
	}
	function routeStyle(route) {
		var style = route && route.style ? route.style : {};
		return { color: style.color || '#e63b2e', width: Number(style.width || 4), opacity: Number(style.opacity == null ? 0.95 : style.opacity) };
	}
	function addRouteGeometry(features, route) {
		var style = routeStyle(route);
		function pushGeometry(geometry) {
			if (!geometry || (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString')) return;
			features.push({ type:'Feature', properties:{ route_id: route.id || '', name: route.name || route.id || 'Route', color: style.color, width: style.width, opacity: style.opacity }, geometry: geometry });
		}
		if (route.geojson) {
			if (route.geojson.type === 'FeatureCollection') (route.geojson.features || []).forEach(function (feature) { pushGeometry(feature && feature.geometry); });
			else if (route.geojson.type === 'Feature') pushGeometry(route.geojson.geometry);
			else pushGeometry(route.geojson);
		} else if (Array.isArray(route.waypoints) && route.waypoints.length > 1) {
			pushGeometry({ type:'LineString', coordinates: route.waypoints.map(function (wp) { return [Number(wp[0]), Number(wp[1])]; }) });
		}
	}
	function allVisibleRouteData() {
		var lines = [];
		var points = [];
		(state().routes || []).forEach(function (route) {
			if (!route || route.visible === false) return;
			addRouteGeometry(lines, route);
			(route.waypoints || []).forEach(function (wp, i) {
				points.push({ type:'Feature', properties:{ route_id: route.id || '', label:String(i + 1), index:i }, geometry:{ type:'Point', coordinates:[Number(wp[0]), Number(wp[1])] } });
			});
		});
		return { lines:{ type:'FeatureCollection', features:lines }, points:{ type:'FeatureCollection', features:points } };
	}
	function render() {
		var map = window.WildMapsAdminMap;
		if (!map || !ensureLegacyLayers(map)) return;
		var data = allVisibleRouteData();
		map.getSource('swm-admin-route').setData(data.lines);
		map.getSource('swm-admin-route-waypoints').setData(data.points);
		var route = activeRoute();
		renderList(route && route.visible !== false ? (route.waypoints || []) : []);
	}
	function renderList(waypoints) {
		var list = byId('swm-route-waypoints-list');
		if (!list) return;
		if (!waypoints.length) { list.innerHTML = '<li class="swm-route-empty">No stops yet. Enable Route mode and click the map, or search a place and add it as a stop.</li>'; return; }
		list.innerHTML = waypoints.map(function (wp, index) {
			var lng = Number(wp[0]); var lat = Number(wp[1]); var name = wp[2] || '';
			return '<li class="swm-route-waypoint-row" data-index="' + index + '"><span class="swm-route-number">' + (index + 1) + '</span><div class="swm-route-waypoint-main"><input type="text" class="regular-text swm-route-name" value="' + esc(name) + '" placeholder="Stop name" /><code>' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</code><div class="swm-route-waypoint-actions"><button type="button" class="button-link swm-route-zoom">centra</button><button type="button" class="button-link swm-route-up">su</button><button type="button" class="button-link swm-route-down">giù</button><button type="button" class="button-link-delete swm-route-remove">rimuovi</button></div></div></li>';
		}).join('');
		Array.prototype.forEach.call(list.querySelectorAll('li[data-index]'), function (row) {
			var index = Number(row.getAttribute('data-index'));
			var input = row.querySelector('.swm-route-name');
			if (input) input.addEventListener('change', mark(function () { var route = activeRoute(); if (!route) return; var wp = (route.waypoints || []).slice(); if (wp[index]) wp[index] = [wp[index][0], wp[index][1], input.value]; updateActiveRoute({ waypoints: wp }); render(); }));
			var remove = row.querySelector('.swm-route-remove'); if (remove) remove.addEventListener('click', mark(function () { removeStop(index); }));
			var up = row.querySelector('.swm-route-up'); if (up) up.addEventListener('click', mark(function () { moveStop(index, index - 1); }));
			var down = row.querySelector('.swm-route-down'); if (down) down.addEventListener('click', mark(function () { moveStop(index, index + 1); }));
			var zoom = row.querySelector('.swm-route-zoom'); if (zoom) zoom.addEventListener('click', mark(function () { var wp = (activeRoute() && activeRoute().waypoints || [])[index]; var map = window.WildMapsAdminMap; if (wp && map) map.flyTo({ center:[Number(wp[0]), Number(wp[1])], zoom:12, duration:400 }); }));
		});
	}
	var routeMode = false;
	function setRouteMode(on) {
		routeMode = !!on;
		window.SWM_ROUTE_MODE_ACTIVE = routeMode;
		var btn = byId('swm-route-mode');
		if (btn) { btn.textContent = 'Route mode: ' + (routeMode ? 'ON' : 'OFF'); btn.classList.toggle('button-primary', routeMode); }
		status(routeMode ? 'Click the map to add stops to the active route.' : 'Route mode OFF.', 'info');
	}
	function addStop(lng, lat, name) {
		if (!currentProjectId()) { status('Select a project first.', 'error'); return; }
		var route = activeRoute();
		if (!route) { status('Create or select a route first.', 'error'); return; }
		var wp = (route.waypoints || []).slice();
		wp.push([Number(Number(lng).toFixed(6)), Number(Number(lat).toFixed(6)), name || ('Stop ' + (wp.length + 1))]);
		updateActiveRoute({ waypoints: wp, geojson: null });
		render();
	}
	function removeStop(index) { var route = activeRoute(); if (!route) return; var wp = (route.waypoints || []).slice(); if (index < 0 || index >= wp.length) return; wp.splice(index, 1); updateActiveRoute({ waypoints: wp, geojson: null }); render(); }
	function moveStop(from, to) { var route = activeRoute(); if (!route) return; var wp = (route.waypoints || []).slice(); if (from < 0 || from >= wp.length || to < 0 || to >= wp.length) return; var item = wp.splice(from, 1)[0]; wp.splice(to, 0, item); updateActiveRoute({ waypoints: wp, geojson: null }); render(); }
	function calculateRoute() {
		var route = activeRoute();
		if (!route || !Array.isArray(route.waypoints) || route.waypoints.length < 2) { status('At least 2 stops are required.', 'error'); return; }
		var profile = byId('swm-route-profile');
		status('Calcolo percorso OpenRouteService...', 'info');
		post('swm_admin_ors_route', { profile: profile ? profile.value : 'driving-car', coordinates: JSON.stringify(route.waypoints.map(function (wp) { return [Number(wp[0]), Number(wp[1])]; })) }).then(function (data) {
			updateActiveRoute({ geojson: data.route || null });
			render();
			status('Percorso su strada calcolato. Ora puoi salvarlo nel progetto.', 'success');
		}).catch(function (e) { status(e.message, 'error'); });
	}
	function clearActiveRoute() { var route = activeRoute(); if (!route) return; updateActiveRoute({ geojson: null, waypoints: [] }); render(); saveCollection('Route and stops cleared.').catch(function () {}); }
	function bindButtons() {
		var mode = byId('swm-route-mode'); if (mode && !mode.__swmActiveRouteStops) { mode.__swmActiveRouteStops = true; mode.addEventListener('click', mark(function (e) { e.preventDefault(); setRouteMode(!routeMode); })); }
		var calc = byId('swm-route-calc'); if (calc && !calc.__swmActiveRouteStops) { calc.__swmActiveRouteStops = true; calc.addEventListener('click', mark(function (e) { e.preventDefault(); calculateRoute(); })); }
		var save = byId('swm-route-save'); if (save && !save.__swmActiveRouteStops) { save.__swmActiveRouteStops = true; save.addEventListener('click', mark(function (e) { e.preventDefault(); saveCollection(); })); }
		var clear = byId('swm-route-clear'); if (clear && !clear.__swmActiveRouteStops) { clear.__swmActiveRouteStops = true; clear.addEventListener('click', mark(function (e) { e.preventDefault(); if (window.confirm('Clear current route and stops?')) clearActiveRoute(); })); }
		var undo = byId('swm-route-undo'); if (undo && !undo.__swmActiveRouteStops) { undo.__swmActiveRouteStops = true; undo.addEventListener('click', mark(function (e) { e.preventDefault(); var route = activeRoute(); removeStop(((route && route.waypoints) || []).length - 1); })); }
		var reverse = byId('swm-route-reverse'); if (reverse && !reverse.__swmActiveRouteStops) { reverse.__swmActiveRouteStops = true; reverse.addEventListener('click', mark(function (e) { e.preventDefault(); var route = activeRoute(); if (!route) return; updateActiveRoute({ waypoints:(route.waypoints || []).slice().reverse(), geojson:null }); render(); })); }
		var saveList = byId('swm-route-save-list'); if (saveList && !saveList.__swmActiveRouteStops) { saveList.__swmActiveRouteStops = true; saveList.addEventListener('click', mark(function (e) { e.preventDefault(); saveCollection('Elenco tappe salvato.'); })); }
	}
	function bindMap(map) {
		if (!map || map.__swmActiveRouteStopsBound) return;
		map.__swmActiveRouteStopsBound = true;
		map.on('click', function (event) {
			if (!routeMode) return;
			var defaultName = 'Stop ' + (((activeRoute() && activeRoute().waypoints) || []).length + 1);
			var name = window.prompt('Stop name', defaultName);
			if (name === null) return;
			addStop(event.lngLat.lng, event.lngLat.lat, String(name || defaultName).trim());
		});
		map.on('load', render); map.on('styledata', render); render();
	}
	function boot() {
		bindButtons();
		if (window.WildMapsAdminMap) bindMap(window.WildMapsAdminMap);
		var s = store();
		if (s && s.on && !s.__swmActiveRouteStopsRenderBound) { s.__swmActiveRouteStopsRenderBound = true; s.on('change', render); }
		window.setTimeout(boot, 500);
	}
	window.addEventListener('wildmaps:admin-map-ready', function (event) { bindMap(event.detail && event.detail.map); });
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window, document);
