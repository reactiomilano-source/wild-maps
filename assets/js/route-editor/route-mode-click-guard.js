(function (window, document) {
	'use strict';

	window.SWM_ROUTE_MODE_ACTIVE = !!window.SWM_ROUTE_MODE_ACTIVE;

	function store() { return window.WildMapsRouteEditorStore || null; }
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
	function status(text, type) {
		var el = document.getElementById('swm-route-status');
		if (!el) return;
		el.textContent = text || '';
		el.className = type ? 'is-' + type : '';
	}
	function safeAddRouteStop(event) {
		if (!window.SWM_ROUTE_MODE_ACTIVE) return;
		var route = activeRoute();
		if (!route) { status('Create or select a route first.', 'error'); return; }
		var waypoints = (route.waypoints || []).slice();
		var defaultName = 'Stop ' + (waypoints.length + 1);
		var name = window.prompt('Stop name', defaultName);
		if (name === null) return;
		name = String(name || defaultName).trim();
		waypoints.push([Number(Number(event.lngLat.lng).toFixed(6)), Number(Number(event.lngLat.lat).toFixed(6)), name]);
		updateActiveRoute({ waypoints: waypoints, geojson: null });
		status('Stop added. When you have at least 2 stops, calculate the road route.', 'info');
	}
	function patchMapLibre() {
		if (!window.maplibregl || !window.maplibregl.Map || window.maplibregl.Map.prototype.__swmRouteClickGuard) return !!(window.maplibregl && window.maplibregl.Map);
		var proto = window.maplibregl.Map.prototype;
		var originalOn = proto.on;
		proto.__swmRouteClickGuard = true;
		proto.on = function (type, layerOrListener, listener) {
			if (type === 'click') {
				if (typeof layerOrListener === 'function') {
					var fn = layerOrListener;
					if (!fn.__swmRouteClickGuardSafe) {
						layerOrListener = function (event) {
							if (window.SWM_ROUTE_MODE_ACTIVE) return;
							return fn.call(this, event);
						};
					}
				} else if (typeof listener === 'function' && !listener.__swmRouteClickGuardSafe) {
					var originalLayerListener = listener;
					listener = function (event) {
						if (window.SWM_ROUTE_MODE_ACTIVE) return;
						return originalLayerListener.call(this, event);
					};
				}
			}
			return originalOn.call(this, type, layerOrListener, listener);
		};
		return true;
	}
	function bindSafeMapClick() {
		var map = window.WildMapsAdminMap;
		if (!map || map.__swmSafeRouteClickBound) return;
		map.__swmSafeRouteClickBound = true;
		var handler = function (event) { safeAddRouteStop(event); };
		handler.__swmRouteClickGuardSafe = true;
		map.on('click', handler);
	}
	function bindButtonState() {
		var btn = document.getElementById('swm-route-mode');
		if (!btn || btn.__swmRouteModeGuardBound) return;
		btn.__swmRouteModeGuardBound = true;
		btn.addEventListener('click', function () {
			window.setTimeout(function () {
				window.SWM_ROUTE_MODE_ACTIVE = btn.classList.contains('button-primary') || /ON|attiva/i.test(btn.textContent || '');
			}, 0);
		}, true);
	}
	function boot() {
		patchMapLibre();
		bindButtonState();
		bindSafeMapClick();
		window.setTimeout(boot, 300);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window, document);
