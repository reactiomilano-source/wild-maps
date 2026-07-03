(function (window, document) {
	'use strict';

	if (!window.WildMapsRouteStore) return;

	var store = new window.WildMapsRouteStore({ routes: [], activeRouteId: '' });
	window.WildMapsRouteEditorStore = store;

	var lastProjectId = '';
	var hydrating = false;

	function parseBody(init) {
		if (!init || !init.body) return null;
		try {
			if (typeof init.body === 'string') return new URLSearchParams(init.body);
			if (init.body instanceof URLSearchParams) return init.body;
		} catch (e) {}
		return null;
	}

	function syncFromPayload(payload, source) {
		if (!payload || typeof payload !== 'object') return;
		if (Array.isArray(payload.routes)) {
			store.load({ routes: payload.routes, activeRouteId: payload.active_route_id || payload.activeRouteId || '' });
		} else if (source === 'swm_admin_get_routes' || source === 'swm_admin_save_routes') {
			store.load({ routes: [], activeRouteId: '' });
		}
	}

	function ajaxUrl() { return window.SWM_ADMIN && window.SWM_ADMIN.ajaxUrl ? window.SWM_ADMIN.ajaxUrl : ''; }
	function nonce() { return window.SWM_ADMIN && window.SWM_ADMIN.nonce ? window.SWM_ADMIN.nonce : ''; }
	function projectId() {
		var el = document.getElementById('swm-current-project');
		return el ? String(el.value || '') : '';
	}

	var originalFetch = window.fetch;
	if (!originalFetch || originalFetch.__swmRouteStoreBridge) return;

	function hydrateRoutes(id, force) {
		id = id || projectId();
		if (!id || !ajaxUrl() || hydrating) return;
		if (!force && lastProjectId === id) return;
		lastProjectId = id;
		hydrating = true;
		var body = new URLSearchParams({ action: 'swm_admin_get_routes', nonce: nonce(), project_id: id });
		originalFetch.call(window, ajaxUrl(), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		}).then(function (response) { return response.json(); }).then(function (json) {
			if (json && json.success && json.data) syncFromPayload(json.data, 'swm_admin_get_routes');
		}).catch(function () {}).then(function () { hydrating = false; });
	}

	function bridgedFetch(input, init) {
		var params = parseBody(init);
		var action = params ? params.get('action') : '';
		var shouldWatch = action && (
			action === 'swm_admin_get_routes' ||
			action === 'swm_admin_save_routes' ||
			action === 'swm_admin_ors_route'
		);

		return originalFetch.apply(this, arguments).then(function (response) {
			if (!shouldWatch || !response || !response.clone) return response;
			response.clone().json().then(function (json) {
				if (!json || !json.success || !json.data) return;
				if (action === 'swm_admin_get_routes' || action === 'swm_admin_save_routes') {
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

	function bootHydration() {
		var select = document.getElementById('swm-current-project');
		if (select && !select.__swmRouteStoreBridgeBound) {
			select.__swmRouteStoreBridgeBound = true;
			select.addEventListener('change', function () { hydrateRoutes(select.value, true); });
		}
		var id = projectId();
		if (id && id !== lastProjectId) hydrateRoutes(id, true);
		window.setTimeout(bootHydration, 500);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootHydration); else bootHydration();
})(window, document);
