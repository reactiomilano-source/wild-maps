(function (window) {
	'use strict';

	var SOURCE_ID = 'swm-admin-routes-visible';
	var LINE_LAYER_ID = 'swm-admin-routes-visible-lines';
	var POINT_SOURCE_ID = 'swm-admin-routes-visible-points';
	var POINT_LAYER_ID = 'swm-admin-routes-visible-points';
	var LABEL_LAYER_ID = 'swm-admin-routes-visible-labels';
	var map = null;
	var unsubscribe = null;

	function store() { return window.WildMapsRouteEditorStore || null; }
	function emptyCollection() { return { type: 'FeatureCollection', features: [] }; }
	function routeStyle(route) {
		var style = route && route.style ? route.style : {};
		return {
			color: style.color || '#e63b2e',
			width: Number(style.width || 4),
			opacity: Number(style.opacity == null ? 0.95 : style.opacity)
		};
	}
	function routeFeatures(route) {
		var out = [];
		var style = routeStyle(route);
		var features = route && route.geojson && Array.isArray(route.geojson.features) ? route.geojson.features : [];
		features.forEach(function (feature) {
			if (!feature || !feature.geometry) return;
			var geomType = feature.geometry.type;
			if (geomType !== 'LineString' && geomType !== 'MultiLineString') return;
			out.push({
				type: 'Feature',
				properties: {
					route_id: route.id || '',
					name: route.name || route.id || 'Route',
					color: style.color,
					width: style.width,
					opacity: style.opacity
				},
				geometry: feature.geometry
			});
		});
		if (!out.length && Array.isArray(route.waypoints) && route.waypoints.length > 1) {
			out.push({
				type: 'Feature',
				properties: { route_id: route.id || '', name: route.name || route.id || 'Route', color: style.color, width: style.width, opacity: style.opacity },
				geometry: { type: 'LineString', coordinates: route.waypoints.map(function (wp) { return [Number(wp[0]), Number(wp[1])]; }) }
			});
		}
		return out;
	}
	function waypointFeatures(route) {
		if (!route || !Array.isArray(route.waypoints)) return [];
		return route.waypoints.map(function (wp, index) {
			return {
				type: 'Feature',
				properties: { route_id: route.id || '', name: wp[2] || ('Stop ' + (index + 1)), label: String(index + 1) },
				geometry: { type: 'Point', coordinates: [Number(wp[0]), Number(wp[1])] }
			};
		}).filter(function (feature) {
			var c = feature.geometry.coordinates;
			return isFinite(c[0]) && isFinite(c[1]);
		});
	}
	function collectionFromState(state) {
		var lines = [];
		var points = [];
		(state.routes || []).forEach(function (route) {
			if (!route || route.visible === false) return;
			lines = lines.concat(routeFeatures(route));
			points = points.concat(waypointFeatures(route));
		});
		return { lines: { type: 'FeatureCollection', features: lines }, points: { type: 'FeatureCollection', features: points } };
	}
	function ensureLayers() {
		if (!map || !map.isStyleLoaded || !map.isStyleLoaded()) return false;
		if (!map.getSource(SOURCE_ID)) {
			map.addSource(SOURCE_ID, { type: 'geojson', data: emptyCollection() });
		}
		if (!map.getLayer(LINE_LAYER_ID)) {
			map.addLayer({
				id: LINE_LAYER_ID,
				type: 'line',
				source: SOURCE_ID,
				layout: { 'line-join': 'round', 'line-cap': 'round' },
				paint: {
					'line-color': ['coalesce', ['get', 'color'], '#e63b2e'],
					'line-width': ['coalesce', ['get', 'width'], 4],
					'line-opacity': ['coalesce', ['get', 'opacity'], 0.95]
				}
			});
		}
		if (!map.getSource(POINT_SOURCE_ID)) {
			map.addSource(POINT_SOURCE_ID, { type: 'geojson', data: emptyCollection() });
		}
		if (!map.getLayer(POINT_LAYER_ID)) {
			map.addLayer({ id: POINT_LAYER_ID, type: 'circle', source: POINT_SOURCE_ID, paint: { 'circle-radius': 8, 'circle-color': '#111', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
		}
		if (!map.getLayer(LABEL_LAYER_ID)) {
			map.addLayer({ id: LABEL_LAYER_ID, type: 'symbol', source: POINT_SOURCE_ID, layout: { 'text-field': ['get', 'label'], 'text-size': 10, 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } });
		}
		return true;
	}
	function render() {
		var s = store();
		if (!map || !s || !s.getState || !ensureLayers()) return;
		var data = collectionFromState(s.getState());
		if (map.getSource(SOURCE_ID)) map.getSource(SOURCE_ID).setData(data.lines);
		if (map.getSource(POINT_SOURCE_ID)) map.getSource(POINT_SOURCE_ID).setData(data.points);
	}
	function bindStore() {
		var s = store();
		if (!s || !s.on || unsubscribe) return;
		unsubscribe = s.on('change', render);
		render();
	}
	function setMap(nextMap) {
		if (!nextMap || map === nextMap) return;
		map = nextMap;
		map.on('load', render);
		map.on('styledata', render);
		render();
		bindStore();
	}
	function boot() {
		if (window.WildMapsAdminMap) setMap(window.WildMapsAdminMap);
		bindStore();
		if (!map || !store()) window.setTimeout(boot, 300);
	}
	window.addEventListener('wildmaps:admin-map-ready', function (event) { setMap(event.detail && event.detail.map); });
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})(window);
