(function (window) {
	'use strict';

	if (window.__swmRouteMarkerDragStoreSync) return;
	window.__swmRouteMarkerDragStoreSync = true;

	function isRouteMarker(marker) {
		try {
			var el = marker && marker.getElement && marker.getElement();
			return !!(el && el.classList && el.classList.contains('swm-admin-route-marker'));
		} catch (e) {
			return false;
		}
	}

	function markerIndex(marker) {
		try {
			var el = marker.getElement();
			var n = parseInt(String(el.textContent || '').trim(), 10);
			return isFinite(n) ? n - 1 : -1;
		} catch (e) {
			return -1;
		}
	}

	function activeRouteId(state) {
		return state && (state.activeRouteId || ((state.routes || [])[0] && state.routes[0].id) || '');
	}

	function syncMarker(marker) {
		var store = window.WildMapsRouteEditorStore;
		if (!store || !store.getState) return;
		var state = store.getState();
		var routeId = activeRouteId(state);
		if (!routeId) return;
		var route = (state.routes || []).find(function (item) { return item && item.id === routeId; });
		if (!route || !Array.isArray(route.waypoints)) return;
		var index = markerIndex(marker);
		if (index < 0 || index >= route.waypoints.length) return;
		var ll = marker.getLngLat();
		var next = route.waypoints.slice();
		var old = next[index] || [];
		next[index] = [Number(Number(ll.lng).toFixed(6)), Number(Number(ll.lat).toFixed(6)), old[2] || ('Stop ' + (index + 1))];
		if (store.setWaypoints) store.setWaypoints(routeId, next);
	}

	function patch(lib) {
		if (!lib || !lib.Marker || lib.Marker.prototype.__swmRouteMarkerDragStoreSyncPatched) return;
		var proto = lib.Marker.prototype;
		var originalOn = proto.on;
		proto.__swmRouteMarkerDragStoreSyncPatched = true;
		proto.on = function (type, listener) {
			if (type === 'dragend' && typeof listener === 'function' && isRouteMarker(this)) {
				var marker = this;
				var wrapped = function () {
					var result = listener.apply(this, arguments);
					window.setTimeout(function () { syncMarker(marker); }, 0);
					return result;
				};
				return originalOn.call(this, type, wrapped);
			}
			return originalOn.apply(this, arguments);
		};
	}

	function boot() {
		if (window.maplibregl) patch(window.maplibregl);
		window.setTimeout(boot, 300);
	}

	boot();
})(window);
