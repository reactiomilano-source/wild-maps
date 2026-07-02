(function (window) {
	'use strict';

	if (!window.WildMapsRouteStore) return;

	var store = new window.WildMapsRouteStore({ routes: [], activeRouteId: '' });
	window.WildMapsRouteEditorStore = store;

	function parseBody(init) {
		if (!init || !init.body) return null;
		try {
			if (typeof init.body === 'string') return new URLSearchParams(init.body);
			if (init.body instanceof URLSearchParams) return init.body;
		} catch (e) {}
		return null;
	}

	function parseJson(value, fallback) {
		if (!value) return fallback;
		try { return JSON.parse(value); } catch (e) { return fallback; }
	}

	function hasLegacyPayload(payload) {
		return payload && (payload.route || (Array.isArray(payload.waypoints) && payload.waypoints.length));
	}

	function syncLegacyIntoActive(payload, source) {
		var state = store.getState ? store.getState() : { routes: [], activeRouteId: '' };
		var activeId = payload.active_route_id || payload.activeRouteId || state.activeRouteId || '';
		var routes = Array.isArray(state.routes) ? state.routes : [];
		var found = false;
		routes = routes.map(function (route) {
			if (route.id !== activeId) return route;
			found = true;
			route.geojson = payload.route || route.geojson || null;
			route.waypoints = Array.isArray(payload.waypoints) ? payload.waypoints : (route.waypoints || []);
			return route;
		});
		if (found) {
			store.load({ routes: routes, activeRouteId: activeId });
			store.emit('legacy:sync', { source: source || 'unknown' });
		}
	}

	function syncFromPayload(payload, source) {
		if (!payload || typeof payload !== 'object') return;
		if (Array.isArray(payload.routes)) {
			store.load({ routes: payload.routes, activeRouteId: payload.active_route_id || payload.activeRouteId || '' });
		} else if (hasLegacyPayload(payload)) {
			syncLegacyIntoActive(payload, source);
		} else if (source === 'swm_admin_get_routes' || source === 'swm_admin_save_routes') {
			store.load({ routes: [], activeRouteId: '' });
		}
	}

	function syncFromRequest(params, source) {
		if (!params) return;
		var waypoints = parseJson(params.get('waypoints'), []);
		var route = parseJson(params.get('route'), null);
		if (!route && !waypoints.length) return;
		syncLegacyIntoActive({ route: route, waypoints: waypoints }, source);
	}

	var originalFetch = window.fetch;
	if (!originalFetch || originalFetch.__swmRouteStoreBridge) return;

	function bridgedFetch(input, init) {
		var params = parseBody(init);
		var action = params ? params.get('action') : '';
		var shouldWatch = action && (
			action === 'swm_admin_get_route' ||
			action === 'swm_admin_save_route' ||
			action === 'swm_admin_get_routes' ||
			action === 'swm_admin_save_routes' ||
			action === 'swm_admin_ors_route'
		);

		if (action === 'swm_admin_save_route') {
			syncFromRequest(params, 'save_route_request');
		}

		return originalFetch.apply(this, arguments).then(function (response) {
			if (!shouldWatch || !response || !response.clone) return response;
			response.clone().json().then(function (json) {
				if (!json || !json.success || !json.data) return;
				if (action === 'swm_admin_get_route' || action === 'swm_admin_save_route' || action === 'swm_admin_get_routes' || action === 'swm_admin_save_routes') {
					syncFromPayload(json.data, action);
				} else if (action === 'swm_admin_ors_route' && json.data.route) {
					var active = store.getActiveRoute && store.getActiveRoute();
					if (active) store.setRouteGeojson(active.id, json.data.route);
				}
			}).catch(function () {});
			return response;
		});
	}

	bridgedFetch.__swmRouteStoreBridge = true;
	window.fetch = bridgedFetch;
})(window);
