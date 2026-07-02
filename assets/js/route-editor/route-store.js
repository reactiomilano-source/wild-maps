(function (window) {
	'use strict';

	function clone(value) {
		return JSON.parse(JSON.stringify(value == null ? null : value));
	}

	function normalizeWaypoint(waypoint, index) {
		if (!Array.isArray(waypoint)) return null;
		var lng = Number(waypoint[0]);
		var lat = Number(waypoint[1]);
		if (!isFinite(lng) || !isFinite(lat)) return null;
		var name = String(waypoint[2] || '').trim() || ('Stop ' + (index + 1));
		return [Number(lng.toFixed(6)), Number(lat.toFixed(6)), name];
	}

	function isEmptyMainRoute(route) {
		if (!route || typeof route !== 'object') return false;
		var waypoints = Array.isArray(route.waypoints) ? route.waypoints : [];
		return String(route.id || '') === 'route-main'
			&& (!route.name || String(route.name) === 'Main route')
			&& !route.geojson
			&& !waypoints.length;
	}

	function defaultRoute(id, name) {
		return {
			id: id || ('route-' + Date.now()),
			name: name || 'Route',
			visible: true,
			locked: false,
			style: {
				color: '#e63b2e',
				width: 4,
				opacity: 0.95
			},
			geojson: null,
			waypoints: []
		};
	}

	function RouteStore(initialState) {
		this.listeners = {};
		this.activeRouteId = '';
		this.routes = [];
		this.dirty = false;
		this.load(initialState || { routes: [] });
	}

	RouteStore.prototype.on = function (eventName, callback) {
		if (!this.listeners[eventName]) this.listeners[eventName] = [];
		this.listeners[eventName].push(callback);
		return function () {
			this.off(eventName, callback);
		}.bind(this);
	};

	RouteStore.prototype.off = function (eventName, callback) {
		if (!this.listeners[eventName]) return;
		this.listeners[eventName] = this.listeners[eventName].filter(function (listener) {
			return listener !== callback;
		});
	};

	RouteStore.prototype.emit = function (eventName, payload) {
		(this.listeners[eventName] || []).forEach(function (listener) {
			listener(payload || {}, this.getState());
		}, this);
		(this.listeners['change'] || []).forEach(function (listener) {
			listener({ type: eventName, payload: payload || {} }, this.getState());
		}, this);
	};

	RouteStore.prototype.normalizeRoutes = function (routes) {
		var normalized = [];
		(routes || []).forEach(function (route, index) {
			if (!route || typeof route !== 'object' || isEmptyMainRoute(route)) return;
			var item = defaultRoute(route.id || ('route-' + (index + 1)), route.name || ('Route ' + (index + 1)));
			item.visible = route.visible !== false;
			item.locked = !!route.locked;
			item.style = Object.assign({}, item.style, route.style || {});
			item.geojson = route.geojson || null;
			item.waypoints = (Array.isArray(route.waypoints) ? route.waypoints : []).map(normalizeWaypoint).filter(Boolean);
			normalized.push(item);
		});
		return normalized;
	};

	RouteStore.prototype.load = function (state) {
		if (Array.isArray(state.routes)) {
			this.routes = this.normalizeRoutes(state.routes);
		} else if (state.route || (Array.isArray(state.waypoints) && state.waypoints.length)) {
			this.routes = this.normalizeRoutes([{ id: 'route-main', name: 'Main route', geojson: state.route || null, waypoints: state.waypoints }]);
		} else {
			this.routes = [];
		}
		this.activeRouteId = state.activeRouteId || (this.routes[0] && this.routes[0].id) || '';
		this.dirty = false;
		this.emit('route:loaded', { routeId: this.activeRouteId });
	};

	RouteStore.prototype.getState = function () {
		return {
			activeRouteId: this.activeRouteId,
			dirty: this.dirty,
			routes: clone(this.routes)
		};
	};

	RouteStore.prototype.getActiveRoute = function () {
		return this.getRoute(this.activeRouteId);
	};

	RouteStore.prototype.getRoute = function (routeId) {
		return this.routes.find(function (route) {
			return String(route.id) === String(routeId || this.activeRouteId);
		}, this) || null;
	};

	RouteStore.prototype.touch = function (eventName, payload) {
		this.dirty = true;
		this.emit(eventName, payload || {});
	};

	RouteStore.prototype.setActiveRoute = function (routeId) {
		if (!this.getRoute(routeId)) return false;
		this.activeRouteId = routeId;
		this.emit('route:activated', { routeId: routeId });
		return true;
	};

	RouteStore.prototype.createRoute = function (route) {
		var id = route && route.id ? route.id : 'route-' + (this.routes.length + 1);
		var item = defaultRoute(id, route && route.name ? route.name : 'Route ' + (this.routes.length + 1));
		if (route) {
			item.visible = route.visible !== false;
			item.locked = !!route.locked;
			item.style = Object.assign({}, item.style, route.style || {});
			item.geojson = route.geojson || null;
			item.waypoints = (Array.isArray(route.waypoints) ? route.waypoints : []).map(normalizeWaypoint).filter(Boolean);
		}
		this.routes.push(item);
		this.activeRouteId = item.id;
		this.touch('route:created', { routeId: item.id });
		return clone(item);
	};

	RouteStore.prototype.setRouteGeojson = function (routeId, geojson) {
		var route = this.getRoute(routeId);
		if (!route) return false;
		route.geojson = geojson || null;
		this.touch('route:geojson:set', { routeId: route.id });
		return true;
	};

	RouteStore.prototype.clearRouteGeojson = function (routeId) {
		return this.setRouteGeojson(routeId, null);
	};

	RouteStore.prototype.getWaypoints = function (routeId) {
		var route = this.getRoute(routeId);
		return route ? clone(route.waypoints) : [];
	};

	RouteStore.prototype.setWaypoints = function (routeId, waypoints) {
		var route = this.getRoute(routeId);
		if (!route) return false;
		route.waypoints = (Array.isArray(waypoints) ? waypoints : []).map(normalizeWaypoint).filter(Boolean);
		this.clearRouteGeojson(route.id);
		this.touch('waypoints:set', { routeId: route.id });
		return true;
	};

	RouteStore.prototype.addWaypoint = function (routeId, waypoint) {
		var route = this.getRoute(routeId);
		if (!route) return false;
		var normalized = normalizeWaypoint(waypoint, route.waypoints.length);
		if (!normalized) return false;
		route.waypoints.push(normalized);
		route.geojson = null;
		this.touch('waypoint:added', { routeId: route.id, index: route.waypoints.length - 1, waypoint: clone(normalized) });
		return true;
	};

	RouteStore.prototype.insertWaypoint = function (routeId, index, waypoint) {
		var route = this.getRoute(routeId);
		if (!route) return false;
		var safeIndex = Math.max(0, Math.min(Number(index), route.waypoints.length));
		var normalized = normalizeWaypoint(waypoint, safeIndex);
		if (!normalized) return false;
		route.waypoints.splice(safeIndex, 0, normalized);
		route.geojson = null;
		this.touch('waypoint:inserted', { routeId: route.id, index: safeIndex, waypoint: clone(normalized) });
		return true;
	};

	RouteStore.prototype.duplicateWaypoint = function (routeId, index) {
		var route = this.getRoute(routeId);
		index = Number(index);
		if (!route || index < 0 || index >= route.waypoints.length) return false;
		var copy = clone(route.waypoints[index]);
		copy[2] = (copy[2] || ('Stop ' + (index + 1))) + ' copy';
		return this.insertWaypoint(route.id, index + 1, copy);
	};

	RouteStore.prototype.removeWaypoint = function (routeId, index) {
		var route = this.getRoute(routeId);
		index = Number(index);
		if (!route || index < 0 || index >= route.waypoints.length) return false;
		var removed = route.waypoints.splice(index, 1)[0];
		route.geojson = null;
		this.touch('waypoint:removed', { routeId: route.id, index: index, waypoint: clone(removed) });
		return true;
	};

	RouteStore.prototype.moveWaypoint = function (routeId, fromIndex, toIndex) {
		var route = this.getRoute(routeId);
		fromIndex = Number(fromIndex);
		toIndex = Number(toIndex);
		if (!route || fromIndex < 0 || fromIndex >= route.waypoints.length || toIndex < 0 || toIndex >= route.waypoints.length || fromIndex === toIndex) return false;
		var item = route.waypoints.splice(fromIndex, 1)[0];
		route.waypoints.splice(toIndex, 0, item);
		route.geojson = null;
		this.touch('waypoint:moved', { routeId: route.id, fromIndex: fromIndex, toIndex: toIndex });
		return true;
	};

	RouteStore.prototype.reverseRoute = function (routeId) {
		var route = this.getRoute(routeId);
		if (!route || route.waypoints.length < 2) return false;
		route.waypoints.reverse();
		route.geojson = null;
		this.touch('route:reversed', { routeId: route.id });
		return true;
	};

	RouteStore.prototype.renameWaypoint = function (routeId, index, name) {
		var route = this.getRoute(routeId);
		index = Number(index);
		if (!route || index < 0 || index >= route.waypoints.length) return false;
		route.waypoints[index][2] = String(name || '').trim() || ('Stop ' + (index + 1));
		this.touch('waypoint:renamed', { routeId: route.id, index: index, name: route.waypoints[index][2] });
		return true;
	};

	window.WildMapsRouteStore = RouteStore;
})(window);
