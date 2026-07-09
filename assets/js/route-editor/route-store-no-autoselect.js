(function (window) {
	'use strict';

	if (!window.WildMapsRouteStore || window.__swmRouteStoreNoAutoselect) return;
	window.__swmRouteStoreNoAutoselect = true;

	var proto = window.WildMapsRouteStore.prototype;
	var originalNormalizeRoutes = proto.normalizeRoutes;
	var originalEmit = proto.emit;

	proto.load = function (state) {
		state = state || {};
		if (Array.isArray(state.routes)) {
			this.routes = originalNormalizeRoutes.call(this, state.routes);
		} else if (state.route || (Array.isArray(state.waypoints) && state.waypoints.length)) {
			this.routes = originalNormalizeRoutes.call(this, [{ id: 'route-main', name: 'Main route', geojson: state.route || null, waypoints: state.waypoints }]);
		} else {
			this.routes = [];
		}
		this.activeRouteId = state.activeRouteId || '';
		this.dirty = false;
		originalEmit.call(this, 'route:loaded', { routeId: this.activeRouteId });
	};

	proto.getRoute = function (routeId) {
		if (!routeId) return null;
		return this.routes.find(function (route) {
			return String(route.id) === String(routeId);
		}) || null;
	};
})(window);
