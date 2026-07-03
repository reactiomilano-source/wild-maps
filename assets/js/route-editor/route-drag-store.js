(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }

	function routeStatus(text, type) {
		var el = byId('swm-route-status');
		if (!el) return;
		el.textContent = text || '';
		el.className = type ? 'is-' + type : '';
	}

	function store() {
		return window.WildMapsRouteEditorStore || null;
	}

	function readWaypointsFromDom() {
		var list = byId('swm-route-waypoints-list');
		if (!list) return [];
		return Array.prototype.slice.call(list.querySelectorAll('li[data-index]')).map(function (row) {
			var code = row.querySelector('code');
			var nameInput = row.querySelector('.swm-route-name');
			if (!code) return null;
			var parts = String(code.textContent || '').split(',');
			if (parts.length < 2) return null;
			var lat = Number(parts[0].trim());
			var lng = Number(parts[1].trim());
			if (!isFinite(lat) || !isFinite(lng)) return null;
			return [Number(lng.toFixed(6)), Number(lat.toFixed(6)), nameInput ? nameInput.value : ''];
		}).filter(Boolean);
	}

	function syncDomOrderToStoreOnly() {
		var s = store();
		if (!s || !s.getState || !s.load) return;
		var st = s.getState();
		var routeId = st.activeRouteId;
		if (!routeId) return;
		var waypoints = readWaypointsFromDom();
		if (!waypoints.length) return;
		var routes = (st.routes || []).map(function (route) {
			if (route.id !== routeId) return route;
			return Object.assign({}, route, { waypoints: waypoints, geojson: null });
		});
		s.load({ routes: routes, activeRouteId: routeId });
		routeStatus('Stops reordered. Recalculate and save the route.', 'info');
	}

	function enhanceDragRows() {
		var list = byId('swm-route-waypoints-list');
		if (!list) return;
		Array.prototype.slice.call(list.querySelectorAll('li[data-index]')).forEach(function (row) {
			if (row.getAttribute('data-swm-drag-store-ready') === '1') return;
			row.setAttribute('data-swm-drag-store-ready', '1');
			row.addEventListener('drop', function () {
				window.setTimeout(syncDomOrderToStoreOnly, 80);
			});
		});
	}

	function init() {
		var list = byId('swm-route-waypoints-list');
		if (!list) return;
		enhanceDragRows();
		var observer = new MutationObserver(function () { enhanceDragRows(); });
		observer.observe(list, { childList: true, subtree: true });
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
