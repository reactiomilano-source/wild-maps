(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }
	function currentProjectId() { var el = byId('swm-current-project'); return el ? el.value : ''; }
	function status(text, type) { var el = byId('swm-route-status'); if (!el) return; el.textContent = text || ''; el.className = type ? 'is-' + type : ''; }
	function store() { return window.WildMapsRouteEditorStore || null; }
	function emptyFc() { return { type: 'FeatureCollection', features: [] }; }
	function post(action, data) {
		var body = new URLSearchParams(Object.assign({ action: action, nonce: window.SWM_ADMIN ? window.SWM_ADMIN.nonce : '' }, data || {}));
		return fetch(window.SWM_ADMIN.ajaxUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: body.toString() }).then(function (r) { return r.json(); }).then(function (json) {
			if (!json || !json.success) throw new Error((json && json.data && json.data.message) || 'Errore salvataggio route.');
			return json.data;
		});
	}
	function activeRoute() {
		var s = store();
		var state = s && s.getState ? s.getState() : null;
		if (!state || !Array.isArray(state.routes)) return null;
		return state.routes.find(function (route) { return route.id === state.activeRouteId; }) || state.routes[0] || null;
	}
	function readStopNames() {
		var rows = document.querySelectorAll('#swm-route-waypoints-list li[data-index]');
		var names = [];
		Array.prototype.forEach.call(rows, function (row) {
			var input = row.querySelector('.swm-route-name');
			names[Number(row.getAttribute('data-index'))] = input ? input.value : '';
		});
		return names;
	}
	function coordsToWaypoints(coords) {
		var names = readStopNames();
		return (Array.isArray(coords) ? coords : []).map(function (coord, index) {
			return [Number(Number(coord[0]).toFixed(6)), Number(Number(coord[1]).toFixed(6)), names[index] || ('Stop ' + (index + 1))];
		}).filter(function (wp) { return isFinite(wp[0]) && isFinite(wp[1]); });
	}
	function updateActiveRoute(patch) {
		var s = store();
		if (!s || !s.getState || !s.load) return false;
		var state = s.getState();
		var activeId = state.activeRouteId || ((state.routes || [])[0] && state.routes[0].id) || '';
		var changed = false;
		var routes = (state.routes || []).map(function (route) {
			if (route.id !== activeId) return route;
			changed = true;
			return Object.assign({}, route, patch || {});
		});
		if (!changed) return false;
		s.load({ routes: routes, activeRouteId: activeId });
		return true;
	}
	function saveCollection(message) {
		var s = store();
		if (!currentProjectId()) { status('Select a project first.', 'error'); return; }
		if (!s || !s.getState) { status('Route manager non pronto.', 'error'); return; }
		var state = s.getState();
		if (!state || !state.activeRouteId || !Array.isArray(state.routes) || !state.routes.length) { status('Create or select a route first.', 'error'); return; }
		post('swm_admin_save_routes', { project_id: currentProjectId(), active_route_id: state.activeRouteId, routes: JSON.stringify(state.routes) }).then(function (data) {
			if (s.load) s.load({ routes: data.routes || state.routes, activeRouteId: data.active_route_id || state.activeRouteId });
			status(message || 'Route saved in the project.', 'success');
		}).catch(function (e) { status(e.message, 'error'); });
	}
	function clearAdminRouteMap() {
		try {
			var map = window.WildMapsAdminMap;
			if (map && map.getSource && map.getSource('swm-admin-route')) map.getSource('swm-admin-route').setData(emptyFc());
			if (map && map.getSource && map.getSource('swm-admin-route-waypoints')) map.getSource('swm-admin-route-waypoints').setData(emptyFc());
		} catch (e) {}
		var list = byId('swm-route-waypoints-list');
		if (list) list.innerHTML = '<li class="swm-route-empty">No stops yet. Enable Route mode and click the map, or search a place and add it as a stop.</li>';
	}
	function clearActiveRoute() {
		if (!activeRoute()) return;
		updateActiveRoute({ geojson: null, waypoints: [] });
		clearAdminRouteMap();
		window.setTimeout(function () { saveCollection('Route and stops cleared.'); }, 20);
	}
	function syncLegacyVisibility() {
		var active = activeRoute();
		if (!active || active.visible !== false) return;
		clearAdminRouteMap();
	}
	function bindButtons() {
		var save = byId('swm-route-save');
		if (save && save.getAttribute('data-swm-collection-save') !== '1') {
			save.setAttribute('data-swm-collection-save', '1');
			save.addEventListener('click', function (event) { event.preventDefault(); event.stopImmediatePropagation(); saveCollection(); }, true);
		}
		var clear = byId('swm-route-clear');
		if (clear && clear.getAttribute('data-swm-collection-clear') !== '1') {
			clear.setAttribute('data-swm-collection-clear', '1');
			clear.addEventListener('click', function (event) { event.preventDefault(); event.stopImmediatePropagation(); if (window.confirm('Clear current route and stops?')) clearActiveRoute(); }, true);
		}
	}
	var originalFetch = window.fetch;
	if (originalFetch && !originalFetch.__swmRouteCollectionSync) {
		function wrappedFetch(input, init) {
			var params = null;
			try {
				if (init && typeof init.body === 'string') params = new URLSearchParams(init.body);
				else if (init && init.body instanceof URLSearchParams) params = init.body;
			} catch (e) {}
			var action = params ? params.get('action') : '';
			var coords = [];
			if (action === 'swm_admin_ors_route') {
				try { coords = JSON.parse(params.get('coordinates') || '[]'); } catch (e) { coords = []; }
				updateActiveRoute({ waypoints: coordsToWaypoints(coords), geojson: null });
			}
			return originalFetch.apply(this, arguments).then(function (response) {
				if (action !== 'swm_admin_ors_route' || !response || !response.clone) return response;
				response.clone().json().then(function (json) {
					if (json && json.success && json.data && json.data.route) {
						updateActiveRoute({ waypoints: coordsToWaypoints(coords), geojson: json.data.route });
					}
				}).catch(function () {});
				return response;
			});
		}
		wrappedFetch.__swmRouteCollectionSync = true;
		window.fetch = wrappedFetch;
	}
	function bind() {
		bindButtons();
		window.addEventListener('swm:route-deleted', clearAdminRouteMap);
		var s = store();
		if (s && s.on && !s.__swmLegacyVisibilityBound) {
			s.__swmLegacyVisibilityBound = true;
			s.on('change', syncLegacyVisibility);
		}
		window.setTimeout(bind, 500);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})(window, document);
