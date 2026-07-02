(function (window, document) {
	'use strict';

	var markers = [];
	var rendering = false;

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
	function clearMarkers() {
		markers.forEach(function (marker) { try { marker.remove(); } catch (e) {} });
		markers = [];
	}
	function markerElement(index) {
		var el = document.createElement('div');
		el.className = 'swm-draggable-route-stop-marker';
		el.textContent = String(index + 1);
		el.title = 'Drag stop to move it';
		el.style.width = '28px';
		el.style.height = '28px';
		el.style.borderRadius = '50%';
		el.style.background = '#111827';
		el.style.color = '#fff';
		el.style.display = 'flex';
		el.style.alignItems = 'center';
		el.style.justifyContent = 'center';
		el.style.fontWeight = '700';
		el.style.fontSize = '12px';
		el.style.border = '2px solid #fff';
		el.style.boxShadow = '0 2px 8px rgba(0,0,0,.35)';
		el.style.cursor = 'grab';
		el.style.zIndex = '10';
		return el;
	}
	function updateActiveWaypoint(index, lngLat) {
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
		routeStatus('Stop moved. Recalculate and save the route.', 'info');
	}
	function renderMarkers() {
		if (rendering) return;
		rendering = true;
		window.setTimeout(function () {
			rendering = false;
			var map = window.WildMapsAdminMap;
			var route = activeRoute();
			clearMarkers();
			if (!map || !window.maplibregl || !route || route.visible === false || !Array.isArray(route.waypoints)) return;
			route.waypoints.forEach(function (wp, index) {
				var lng = Number(wp[0]);
				var lat = Number(wp[1]);
				if (!isFinite(lng) || !isFinite(lat)) return;
				var marker = new window.maplibregl.Marker({ element: markerElement(index), draggable: true })
					.setLngLat([lng, lat])
					.addTo(map);
				marker.on('dragstart', function () {
					var el = marker.getElement();
					if (el) el.style.cursor = 'grabbing';
				});
				marker.on('dragend', function () {
					var el = marker.getElement();
					if (el) el.style.cursor = 'grab';
					updateActiveWaypoint(index, marker.getLngLat());
				});
				markers.push(marker);
			});
		}, 40);
	}
	function bindStore() {
		var s = store();
		if (!s || !s.on || s.__swmMarkerDragBound) return;
		s.__swmMarkerDragBound = true;
		s.on('change', renderMarkers);
	}
	function boot() {
		bindStore();
		renderMarkers();
		window.setTimeout(boot, 700);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window, document);
