(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }
	function routeStatus(text, type) {
		var el = byId('swm-route-status');
		if (!el) return;
		el.textContent = text || '';
		el.className = type ? 'is-' + type : '';
	}
	function store() { return window.WildMapsRouteEditorStore || null; }
	function state() { var s = store(); return s && s.getState ? s.getState() : { routes: [], activeRouteId: '' }; }
	function activeRoute() { var st = state(); return (st.routes || []).find(function (route) { return route.id === st.activeRouteId; }) || null; }
	function activeRouteId() { var route = activeRoute(); return route ? route.id : ''; }
	function updateActiveWaypoint(index, lngLat, finalMove) {
		var s = store();
		if (!s || !s.getState || !s.load || !lngLat) return;
		var st = s.getState();
		var routeId = st.activeRouteId;
		var routes = (st.routes || []).map(function (route) {
			if (route.id !== routeId) return route;
			var waypoints = (route.waypoints || []).slice();
			index = Number(index);
			if (index < 0 || index >= waypoints.length) return route;
			waypoints[index] = [Number(Number(lngLat.lng).toFixed(6)), Number(Number(lngLat.lat).toFixed(6)), waypoints[index][2] || ('Stop ' + (index + 1))];
			return Object.assign({}, route, { waypoints: waypoints, geojson: null });
		});
		s.load({ routes: routes, activeRouteId: routeId });
		if (finalMove) routeStatus('Stop moved. Recalculate and save the route.', 'info');
	}
	function bindMapStopDrag(map) {
		if (!map || map.__swmRobustStopDragBound) return;
		map.__swmRobustStopDragBound = true;
		var drag = null;
		function waypointLayers() {
			return ['swm-admin-route-waypoint-circles', 'swm-admin-route-waypoint-labels'].filter(function (id) {
				return !!(map.getLayer && map.getLayer(id));
			});
		}
		function featureAt(event) {
			var layers = waypointLayers();
			if (!layers.length || !map.queryRenderedFeatures) return null;
			var features = map.queryRenderedFeatures(event.point, { layers: layers }) || [];
			return features[0] || null;
		}
		map.on('mousedown', function (event) {
			var feature = featureAt(event);
			if (!feature) return;
			var props = feature.properties || {};
			if (props.route_id && props.route_id !== activeRouteId()) return;
			drag = { index: Number(props.index) };
			if (map.dragPan && map.dragPan.disable) map.dragPan.disable();
			map.getCanvas().style.cursor = 'grabbing';
			event.preventDefault();
		});
		map.on('mousemove', function (event) {
			if (drag) {
				updateActiveWaypoint(drag.index, event.lngLat, false);
				return;
			}
			map.getCanvas().style.cursor = featureAt(event) ? 'grab' : '';
		});
		function end(event) {
			if (!drag) return;
			updateActiveWaypoint(drag.index, event && event.lngLat ? event.lngLat : null, true);
			drag = null;
			if (map.dragPan && map.dragPan.enable) map.dragPan.enable();
			map.getCanvas().style.cursor = '';
		}
		map.on('mouseup', end);
		map.on('mouseleave', end);
	}
	function bootMapDrag() {
		if (window.WildMapsAdminMap) bindMapStopDrag(window.WildMapsAdminMap);
		window.setTimeout(bootMapDrag, 500);
	}
	function init() {
		bootMapDrag();
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
