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

	function syncFromPayload(payload, source) {
		if (!payload || typeof payload !== 'object') return;
		if (Array.isArray(payload.routes)) {
			store.load({ routes: payload.routes, activeRouteId: payload.active_route_id || payload.activeRouteId || '' });
		} else if (source === 'swm_admin_get_routes' || source === 'swm_admin_save_routes') {
			store.load({ routes: [], activeRouteId: '' });
		}
	}

	var originalFetch = window.fetch;
	if (!originalFetch || originalFetch.__swmRouteStoreBridge) return;

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
})(window);
