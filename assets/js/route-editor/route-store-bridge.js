(function (window, document) {
	'use strict';

	if (!window.WildMapsRouteStore) return;

	var store = new window.WildMapsRouteStore({ routes: [], activeRouteId: '' });
	window.WildMapsRouteEditorStore = store;
	window.SWM_ROUTE_MODE_ACTIVE = !!window.SWM_ROUTE_MODE_ACTIVE;
	var lastHydratedProjectId = '';
	var hydrating = false;

	function parseBody(init) {
		if (!init || !init.body) return null;
		try {
			if (typeof init.body === 'string') return new URLSearchParams(init.body);
			if (init.body instanceof URLSearchParams) return init.body;
		} catch (e) {}
		return null;
	}

	function activeRouteCoordinates() {
		var active = store.getActiveRoute && store.getActiveRoute();
		if (!active || !Array.isArray(active.waypoints) || active.waypoints.length < 2) return null;
		return active.waypoints.map(function (wp) { return [Number(wp[0]), Number(wp[1])]; }).filter(function (coord) { return isFinite(coord[0]) && isFinite(coord[1]); });
	}

	function rewriteOrsRequest(init) {
		if (!init) return init;
		var params = parseBody(init);
		if (!params || params.get('action') !== 'swm_admin_ors_route') return init;
		var coords = activeRouteCoordinates();
		if (!coords || coords.length < 2) return init;
		params.set('coordinates', JSON.stringify(coords));
		return Object.assign({}, init, { body: params.toString() });
	}

	function syncFromPayload(payload, source) {
		if (!payload || typeof payload !== 'object') return;
		if (Array.isArray(payload.routes)) {
			store.load({ routes: payload.routes, activeRouteId: payload.active_route_id || payload.activeRouteId || '' });
		} else if (source === 'swm_admin_get_routes' || source === 'swm_admin_save_routes') {
			store.load({ routes: [], activeRouteId: '' });
		}
	}

	function adminAjaxUrl() { return window.SWM_ADMIN && window.SWM_ADMIN.ajaxUrl ? window.SWM_ADMIN.ajaxUrl : ''; }
	function nonce() { return window.SWM_ADMIN && window.SWM_ADMIN.nonce ? window.SWM_ADMIN.nonce : ''; }
	function currentProjectId() { var el = document.getElementById('swm-current-project'); return el ? el.value : ''; }
	function storeLooksDefault() {
		var state = store.getState ? store.getState() : { routes: [] };
		return !state.routes || !state.routes.length || state.routes.some(function (route) {
			var style = route && route.style ? route.style : {};
			return style.color === '#e63b2e' && Number(style.width || 4) === 4 && !route.geojson;
		});
	}

	function hydrateProjectRoutes(projectId, force) {
		projectId = projectId || currentProjectId();
		if (!projectId || !adminAjaxUrl() || hydrating) return;
		if (!force && lastHydratedProjectId === String(projectId) && !storeLooksDefault()) return;
		hydrating = true;
		var body = new URLSearchParams({ action: 'swm_admin_get_routes', nonce: nonce(), project_id: projectId });
		originalFetch(adminAjaxUrl(), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		}).then(function (response) { return response.json(); }).then(function (json) {
			if (json && json.success && json.data) {
				lastHydratedProjectId = String(projectId);
				syncFromPayload(json.data, 'swm_admin_get_routes');
			}
		}).catch(function () {}).then(function () { hydrating = false; });
	}

	var originalFetch = window.fetch;
	if (!originalFetch || originalFetch.__swmRouteStoreBridge) return;

	function patchMapClicks() {
		if (!window.maplibregl || !window.maplibregl.Map || window.maplibregl.Map.prototype.__swmRouteModeClickPatch) return;
		var proto = window.maplibregl.Map.prototype;
		var originalOn = proto.on;
		proto.__swmRouteModeClickPatch = true;
		proto.on = function (type, layerOrListener, listener) {
			if (type === 'click') {
				if (typeof layerOrListener === 'function') {
					var fn = layerOrListener;
					if (!fn.__swmActiveRouteStops) {
						layerOrListener = function (event) {
							if (window.SWM_ROUTE_MODE_ACTIVE) return;
							return fn.call(this, event);
						};
					}
				} else if (typeof listener === 'function' && !listener.__swmActiveRouteStops) {
					var layerFn = listener;
					listener = function (event) {
						if (window.SWM_ROUTE_MODE_ACTIVE) return;
						return layerFn.call(this, event);
					};
				}
			}
			return originalOn.call(this, type, layerOrListener, listener);
		};
	}

	function bridgedFetch(input, init) {
		var patchedInit = rewriteOrsRequest(init);
		var params = parseBody(patchedInit);
		var action = params ? params.get('action') : '';
		var projectId = params ? params.get('project_id') : '';
		var shouldWatch = action && (action === 'swm_admin_get_routes' || action === 'swm_admin_save_routes' || action === 'swm_admin_ors_route' || action === 'swm_admin_get_route');

		return originalFetch.call(this, input, patchedInit).then(function (response) {
			if (!shouldWatch || !response || !response.clone) return response;
			response.clone().json().then(function (json) {
				if (!json || !json.success || !json.data) return;
				if (action === 'swm_admin_get_routes' || action === 'swm_admin_save_routes') {
					syncFromPayload(json.data, action);
				} else if (action === 'swm_admin_ors_route' && json.data.route) {
					var active = store.getActiveRoute && store.getActiveRoute();
					if (active) store.setRouteGeojson(active.id, json.data.route);
				} else if (action === 'swm_admin_get_route') {
					window.setTimeout(function () { hydrateProjectRoutes(projectId || currentProjectId(), true); }, 10);
				}
			}).catch(function () {});
			return response;
		});
	}

	bridgedFetch.__swmRouteStoreBridge = true;
	window.fetch = bridgedFetch;

	function bindProjectHydration() {
		patchMapClicks();
		var select = document.getElementById('swm-current-project');
		if (select && !select.__swmRouteHydrationBound) {
			select.__swmRouteHydrationBound = true;
			select.addEventListener('change', function () { lastHydratedProjectId = ''; window.setTimeout(function () { hydrateProjectRoutes(select.value, true); }, 50); });
		}
		if (currentProjectId()) hydrateProjectRoutes(currentProjectId(), storeLooksDefault());
		window.setTimeout(bindProjectHydration, 700);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindProjectHydration); else bindProjectHydration();
})(window, document);
