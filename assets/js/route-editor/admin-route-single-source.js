(function (window, document) {
	'use strict';

	var routeMode = false;
	var stopMarkers = [];
	var hydrating = false;

	function byId(id) { return document.getElementById(id); }
	function store() { return window.WildMapsRouteEditorStore || null; }
	function state() { var s = store(); return s && s.getState ? s.getState() : { routes: [], activeRouteId: '' }; }
	function activeRoute() { var st = state(); return (st.routes || []).find(function (route) { return route.id === st.activeRouteId; }) || null; }
	function status(text, type) { var el = byId('swm-route-status') || byId('swm-gpx-import-status'); if (!el) return; el.textContent = text || ''; el.className = type ? 'is-' + type : ''; }
	function projectId() { var el = byId('swm-current-project'); return el ? el.value : ''; }
	function ajaxUrl() { return window.SWM_ADMIN && window.SWM_ADMIN.ajaxUrl ? window.SWM_ADMIN.ajaxUrl : ''; }
	function nonce() { return window.SWM_ADMIN && window.SWM_ADMIN.nonce ? window.SWM_ADMIN.nonce : ''; }
	function map() { return window.WildMapsAdminMap || null; }
	function post(action, data) {
		var body = new URLSearchParams(Object.assign({ action: action, nonce: nonce() }, data || {}));
		return fetch(ajaxUrl(), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: body.toString() }).then(function (r) { return r.json(); }).then(function (json) {
			if (!json || !json.success) throw new Error((json && json.data && json.data.message) || 'Route error.');
			return json.data;
		});
	}
	function loadRoutes() {
		var pid = projectId();
		var s = store();
		if (!s || !s.load || !pid || !ajaxUrl() || hydrating) return Promise.resolve(false);
		hydrating = true;
		return post('swm_admin_get_routes', { project_id: pid }).then(function (data) {
			s.load({ routes: data.routes || [], activeRouteId: data.active_route_id || '' });
			renderStops();
			return true;
		}).catch(function (e) { status(e.message, 'error'); return false; }).then(function (ok) { hydrating = false; return ok; });
	}
	function saveRoutes(message) {
		var st = state();
		if (!projectId()) { status('Select a project first.', 'error'); return Promise.resolve(false); }
		return post('swm_admin_save_routes', { project_id: projectId(), active_route_id: st.activeRouteId || '', routes: JSON.stringify(st.routes || []) }).then(function (data) {
			var s = store();
			if (s && s.load) s.load({ routes: data.routes || st.routes || [], activeRouteId: data.active_route_id || st.activeRouteId || '' });
			renderStops();
			if (message) status(message, 'success');
			return true;
		}).catch(function (e) { status(e.message, 'error'); return false; });
	}
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
		renderStops();
		return true;
	}
	function setWaypoints(waypoints, message) {
		updateActiveRoute({ waypoints: waypoints, geojson: null });
		if (message) status(message, 'info');
	}
	function addStop(lngLat) {
		if (!projectId()) { status('Select a project first.', 'error'); return; }
		var route = activeRoute();
		if (!route) { status('Create or select a route first.', 'error'); return; }
		var waypoints = (route.waypoints || []).slice();
		var defaultName = 'Stop ' + (waypoints.length + 1);
		var name = window.prompt('Stop name', defaultName);
		if (name === null) return;
		waypoints.push([Number(Number(lngLat.lng).toFixed(6)), Number(Number(lngLat.lat).toFixed(6)), String(name || defaultName).trim()]);
		setWaypoints(waypoints, 'Stop added. Recalculate and save the route.');
	}
	function calculateRoute() {
		var route = activeRoute();
		var waypoints = route && Array.isArray(route.waypoints) ? route.waypoints : [];
		if (waypoints.length < 2) { status('At least 2 stops are required.', 'error'); return; }
		var profile = byId('swm-route-profile');
		status('Calcolo percorso OpenRouteService...', 'info');
		post('swm_admin_ors_route', { profile: profile ? profile.value : 'driving-car', coordinates: JSON.stringify(waypoints.map(function (wp) { return [Number(wp[0]), Number(wp[1])]; })) }).then(function (data) {
			updateActiveRoute({ geojson: data.route || null });
			status('Percorso su strada calcolato. Ora puoi salvarlo nel progetto.', 'success');
		}).catch(function (e) { status(e.message, 'error'); });
	}
	function clearMarkers() {
		stopMarkers.forEach(function (marker) { try { marker.remove(); } catch (e) {} });
		stopMarkers = [];
	}
	function markerElement(index) {
		var el = document.createElement('button');
		el.type = 'button';
		el.className = 'swm-admin-route-marker swm-single-source-route-marker';
		el.textContent = String(index + 1);
		el.title = 'Stop ' + (index + 1) + ' - drag to move';
		return el;
	}
	function renderStops() {
		var m = map();
		var route = activeRoute();
		clearMarkers();
		if (!m || !window.maplibregl || !route || route.visible === false) return;
		(route.waypoints || []).forEach(function (wp, index) {
			var lng = Number(wp[0]);
			var lat = Number(wp[1]);
			if (!isFinite(lng) || !isFinite(lat)) return;
			var marker = new window.maplibregl.Marker({ element: markerElement(index), draggable: true }).setLngLat([lng, lat]).addTo(m);
			marker.getElement().addEventListener('click', function (event) { event.stopPropagation(); });
			marker.on('dragend', function () {
				var ll = marker.getLngLat();
				var current = activeRoute();
				var waypoints = current && Array.isArray(current.waypoints) ? current.waypoints.slice() : [];
				if (index < 0 || index >= waypoints.length) return;
				waypoints[index] = [Number(Number(ll.lng).toFixed(6)), Number(Number(ll.lat).toFixed(6)), waypoints[index][2] || ('Stop ' + (index + 1))];
				setWaypoints(waypoints, 'Stop moved. Recalculate and save the route.');
			});
			stopMarkers.push(marker);
		});
	}
	function updateButton() {
		var btn = byId('swm-route-mode');
		if (!btn) return;
		btn.textContent = 'Modalità percorso: ' + (routeMode ? 'ON' : 'OFF');
		btn.classList.toggle('button-primary', routeMode);
		window.SWM_ROUTE_MODE_ACTIVE = routeMode;
	}
	function bindCanvasGuard() {
		var m = map();
		if (!m || m.__swmSingleSourceCanvasBound) return;
		m.__swmSingleSourceCanvasBound = true;
		var canvas = m.getCanvas && m.getCanvas();
		if (!canvas) return;
		canvas.addEventListener('click', function (event) {
			if (!routeMode) return;
			event.preventDefault();
			event.stopPropagation();
			if (event.stopImmediatePropagation) event.stopImmediatePropagation();
			var rect = canvas.getBoundingClientRect();
			var point = [event.clientX - rect.left, event.clientY - rect.top];
			addStop(m.unproject(point));
		}, true);
	}
	function bindControls() {
		var mode = byId('swm-route-mode');
		if (mode && !mode.__swmSingleSourceBound) {
			mode.__swmSingleSourceBound = true;
			mode.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation(); routeMode = !routeMode; updateButton(); status(routeMode ? 'Click the map to add stops to the active route.' : 'Route mode OFF.', 'info'); }, true);
		}
		var calc = byId('swm-route-calc');
		if (calc && !calc.__swmSingleSourceBound) {
			calc.__swmSingleSourceBound = true;
			calc.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation(); calculateRoute(); }, true);
		}
		var save = byId('swm-route-save');
		if (save && !save.__swmSingleSourceBound) {
			save.__swmSingleSourceBound = true;
			save.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation(); saveRoutes('Route saved in the project.'); }, true);
		}
	}
	function boot() {
		bindControls();
		bindCanvasGuard();
		var s = store();
		if (s && s.on && !s.__swmSingleSourceRenderBound) { s.__swmSingleSourceRenderBound = true; s.on('change', renderStops); }
		var project = byId('swm-current-project');
		if (project && !project.__swmSingleSourceHydrateBound) { project.__swmSingleSourceHydrateBound = true; project.addEventListener('change', function () { window.setTimeout(loadRoutes, 150); }); }
		if (projectId()) loadRoutes();
		window.setTimeout(boot, 700);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
	window.addEventListener('wildmaps:admin-map-ready', function () { window.setTimeout(function () { bindCanvasGuard(); renderStops(); }, 100); });
})(window, document);
