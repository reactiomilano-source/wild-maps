(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }
	function esc(text) { return String(text || '').replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]); }); }
	function status(text, type) {
		var el = byId('swm-route-status');
		if (!el) return;
		el.textContent = text || '';
		el.className = type ? 'is-' + type : '';
	}
	function currentProjectId() { var el = byId('swm-current-project'); return el ? el.value : ''; }
	function store() { return window.WildMapsRouteEditorStore || null; }
	function defaultRoutes() { return [{ id: 'route-main', name: 'Main route', visible: true, locked: false, style: { color: '#e63b2e', width: 4, opacity: 0.95 }, geojson: null, waypoints: [] }]; }
	function ensureStore() {
		var s = store();
		if (!s && window.WildMapsRouteStore) {
			s = new window.WildMapsRouteStore({ routes: defaultRoutes(), activeRouteId: 'route-main' });
			window.WildMapsRouteEditorStore = s;
		}
		return s;
	}
	function getState() {
		var s = ensureStore();
		if (!s || !s.getState) return { activeRouteId: 'route-main', routes: defaultRoutes() };
		var state = s.getState();
		if (!state.routes || !state.routes.length) state.routes = defaultRoutes();
		return state;
	}
	function post(action, data) {
		var body = new URLSearchParams(Object.assign({ action: action, nonce: window.SWM_ADMIN ? window.SWM_ADMIN.nonce : '' }, data || {}));
		return fetch(window.SWM_ADMIN.ajaxUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: body.toString() }).then(function (r) { return r.json(); }).then(function (json) {
			if (!json || !json.success) throw new Error((json && json.data && json.data.message) || 'Errore route.');
			return json.data;
		});
	}
	function loadRoutes() {
		if (!currentProjectId()) return Promise.resolve(false);
		return post('swm_admin_get_routes', { project_id: currentProjectId() }).then(function (data) {
			var s = ensureStore();
			if (s && s.load) s.load({ routes: data.routes || defaultRoutes(), activeRouteId: data.active_route_id || 'route-main' });
			render();
			return true;
		}).catch(function () { return false; });
	}
	function saveRoutes(message) {
		if (!currentProjectId()) return Promise.resolve(false);
		var state = getState();
		return post('swm_admin_save_routes', { project_id: currentProjectId(), active_route_id: state.activeRouteId || 'route-main', routes: JSON.stringify(state.routes || []) }).then(function (data) {
			var s = ensureStore();
			if (s && s.load) s.load({ routes: data.routes || state.routes, activeRouteId: data.active_route_id || state.activeRouteId });
			render();
			if (message) status(message, 'success');
			return true;
		}).catch(function (e) { status(e.message, 'error'); return false; });
	}
	function activeRouteName() {
		var state = getState();
		var active = state.routes.find(function (route) { return route.id === state.activeRouteId; }) || state.routes[0];
		return active ? active.name : 'Main route';
	}
	function render() {
		var panel = byId('swm-multi-route-panel');
		if (!panel) return;
		var state = getState();
		panel.querySelector('.swm-multi-route-list').innerHTML = state.routes.map(function (route) {
			var active = route.id === state.activeRouteId;
			return '<button type="button" class="button ' + (active ? 'button-primary' : '') + '" data-route-id="' + esc(route.id) + '">' + esc(route.name || route.id) + '</button>';
		}).join('');
		var activeLabel = panel.querySelector('.swm-multi-route-active');
		if (activeLabel) activeLabel.textContent = activeRouteName();
	}
	function createRoute() {
		var s = ensureStore();
		if (!s || !s.createRoute) return;
		var state = getState();
		var name = window.prompt('Nome nuova route', 'Route ' + (state.routes.length + 1));
		if (name === null) return;
		var route = s.createRoute({ name: String(name || '').trim() || ('Route ' + (state.routes.length + 1)), waypoints: [], geojson: null });
		render();
		saveRoutes('Route salvata: ' + (route.name || route.id) + '.');
	}
	function renameActiveRoute() {
		var s = ensureStore();
		if (!s || !s.getState) return;
		var state = s.getState();
		var active = state.routes.find(function (route) { return route.id === state.activeRouteId; }) || state.routes[0];
		if (!active) return;
		var name = window.prompt('Nuovo nome route', active.name || active.id);
		if (name === null) return;
		state.routes = state.routes.map(function (route) { if (route.id === active.id) route.name = String(name || active.name || active.id).trim(); return route; });
		s.load({ routes: state.routes, activeRouteId: active.id });
		s.setActiveRoute(active.id);
		render();
		saveRoutes('Route rinominata.');
	}
	function mount() {
		var routeCard = document.querySelector('.swm-admin-route-card');
		if (!routeCard || byId('swm-multi-route-panel')) return;
		var panel = document.createElement('div');
		panel.id = 'swm-multi-route-panel';
		panel.className = 'swm-admin-route-card swm-multi-route-panel';
		panel.innerHTML = '<h2>Routes</h2><p class="description">Active route: <strong class="swm-multi-route-active">Main route</strong></p><div class="swm-multi-route-list"></div><p><button type="button" class="button button-primary" id="swm-route-create">+ New route</button> <button type="button" class="button" id="swm-route-rename">Rename active</button></p><p class="description">Route collection is saved in this project.</p>';
		routeCard.parentNode.insertBefore(panel, routeCard);
		panel.addEventListener('click', function (event) {
			var target = event.target;
			if (target.id === 'swm-route-create') { event.preventDefault(); createRoute(); return; }
			if (target.id === 'swm-route-rename') { event.preventDefault(); renameActiveRoute(); return; }
			if (target && target.getAttribute('data-route-id')) { event.preventDefault(); var s = ensureStore(); if (s && s.setActiveRoute) s.setActiveRoute(target.getAttribute('data-route-id')); render(); saveRoutes('Route attiva: ' + activeRouteName() + '.'); }
		});
		render();
	}
	function init() {
		ensureStore();
		mount();
		var s = store();
		if (s && s.on) s.on('change', render);
		loadRoutes();
		var project = byId('swm-current-project');
		if (project) project.addEventListener('change', function () { window.setTimeout(loadRoutes, 100); });
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})(window, document);
