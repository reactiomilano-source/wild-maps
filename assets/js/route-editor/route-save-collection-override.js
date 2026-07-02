(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }
	function currentProjectId() { var el = byId('swm-current-project'); return el ? el.value : ''; }
	function status(text, type) { var el = byId('swm-route-status'); if (!el) return; el.textContent = text || ''; el.className = type ? 'is-' + type : ''; }
	function store() { return window.WildMapsRouteEditorStore || null; }
	function post(action, data) {
		var body = new URLSearchParams(Object.assign({ action: action, nonce: window.SWM_ADMIN ? window.SWM_ADMIN.nonce : '' }, data || {}));
		return fetch(window.SWM_ADMIN.ajaxUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: body.toString() }).then(function (r) { return r.json(); }).then(function (json) {
			if (!json || !json.success) throw new Error((json && json.data && json.data.message) || 'Errore salvataggio route.');
			return json.data;
		});
	}
	function saveCollection() {
		var s = store();
		if (!currentProjectId()) { status('Select a project first.', 'error'); return; }
		if (!s || !s.getState) { status('Route manager non pronto.', 'error'); return; }
		var state = s.getState();
		if (!state || !state.activeRouteId || !Array.isArray(state.routes) || !state.routes.length) { status('Create or select a route first.', 'error'); return; }
		post('swm_admin_save_routes', { project_id: currentProjectId(), active_route_id: state.activeRouteId, routes: JSON.stringify(state.routes) }).then(function (data) {
			if (s.load) s.load({ routes: data.routes || state.routes, activeRouteId: data.active_route_id || state.activeRouteId });
			status('Route saved in the project.', 'success');
		}).catch(function (e) { status(e.message, 'error'); });
	}
	function clearAdminRouteMap() {
		try {
			var map = window.WildMapsAdminMap;
			if (!map) return;
			if (map.getSource && map.getSource('swm-admin-route')) map.getSource('swm-admin-route').setData({ type: 'FeatureCollection', features: [] });
			if (map.getSource && map.getSource('swm-admin-route-waypoints')) map.getSource('swm-admin-route-waypoints').setData({ type: 'FeatureCollection', features: [] });
		} catch (e) {}
		var list = byId('swm-route-waypoints-list');
		if (list) list.innerHTML = '<li class="swm-route-empty">No stops yet. Enable Route mode and click the map, or search a place and add it as a stop.</li>';
	}
	function bind() {
		var btn = byId('swm-route-save');
		if (btn && btn.getAttribute('data-swm-collection-save') !== '1') {
			btn.setAttribute('data-swm-collection-save', '1');
			btn.addEventListener('click', function (event) { event.preventDefault(); event.stopImmediatePropagation(); saveCollection(); }, true);
		}
		window.addEventListener('swm:route-deleted', clearAdminRouteMap);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})(window, document);
