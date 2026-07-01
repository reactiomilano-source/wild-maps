(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }
	function store() { return window.WildMapsRouteEditorStore || null; }
	function currentProjectId() { var el = byId('swm-current-project'); return el ? el.value : ''; }
	function status(text, type) {
		var el = byId('swm-route-status') || byId('swm-route-style-status');
		if (!el) return;
		el.textContent = text || '';
		el.className = type ? 'is-' + type : '';
	}
	function post(action, data) {
		var body = new URLSearchParams(Object.assign({ action: action, nonce: window.SWM_ADMIN ? window.SWM_ADMIN.nonce : '' }, data || {}));
		return fetch(window.SWM_ADMIN.ajaxUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: body.toString() }).then(function (r) { return r.json(); }).then(function (json) {
			if (!json || !json.success) throw new Error((json && json.data && json.data.message) || 'Errore stile route.');
			return json.data;
		});
	}
	function activeRoute(state) {
		state = state || (store() && store().getState ? store().getState() : null);
		if (!state || !state.routes) return null;
		return state.routes.find(function (route) { return route.id === state.activeRouteId; }) || state.routes[0] || null;
	}
	function cleanStyle(style) {
		style = style || {};
		var width = Number(style.width || 4);
		var opacity = Number(style.opacity == null ? 0.95 : style.opacity);
		return {
			color: /^#[0-9a-f]{6}$/i.test(style.color || '') ? style.color : '#e63b2e',
			width: Math.max(1, Math.min(16, isFinite(width) ? width : 4)),
			opacity: Math.max(0.1, Math.min(1, isFinite(opacity) ? opacity : 0.95))
		};
	}
	function panelHtml() {
		return '<div id="swm-route-style-panel" class="swm-admin-route-card" style="margin-top:12px;">' +
			'<h2>Route style</h2>' +
			'<p class="description">Stile della route attiva. I valori vengono salvati nel progetto.</p>' +
			'<div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;">' +
				'<label>Color<br><input type="color" id="swm-route-style-color" value="#e63b2e"></label>' +
				'<label>Width<br><input type="number" id="swm-route-style-width" min="1" max="16" step="1" value="4" style="width:80px;"></label>' +
				'<label>Opacity<br><input type="number" id="swm-route-style-opacity" min="0.1" max="1" step="0.05" value="0.95" style="width:90px;"></label>' +
				'<button type="button" class="button button-primary" id="swm-route-style-save">Save style</button>' +
			'</div>' +
			'<p id="swm-route-style-status" class="description"></p>' +
		'</div>';
	}
	function mount() {
		if (byId('swm-route-style-panel')) return;
		var panel = byId('swm-multi-route-panel');
		if (!panel) return;
		panel.insertAdjacentHTML('beforeend', panelHtml());
		['swm-route-style-color', 'swm-route-style-width', 'swm-route-style-opacity'].forEach(function (id) {
			var input = byId(id);
			if (input) input.addEventListener('change', applyStylePreview);
		});
		var save = byId('swm-route-style-save');
		if (save) save.addEventListener('click', saveStyle);
		render();
	}
	function formStyle() {
		return cleanStyle({
			color: byId('swm-route-style-color') ? byId('swm-route-style-color').value : '#e63b2e',
			width: byId('swm-route-style-width') ? byId('swm-route-style-width').value : 4,
			opacity: byId('swm-route-style-opacity') ? byId('swm-route-style-opacity').value : 0.95
		});
	}
	function render() {
		if (!byId('swm-route-style-panel')) return;
		var route = activeRoute();
		if (!route) return;
		var style = cleanStyle(route.style);
		if (byId('swm-route-style-color')) byId('swm-route-style-color').value = style.color;
		if (byId('swm-route-style-width')) byId('swm-route-style-width').value = style.width;
		if (byId('swm-route-style-opacity')) byId('swm-route-style-opacity').value = style.opacity;
	}
	function updateActiveRouteStyle(style) {
		var s = store();
		if (!s || !s.getState || !s.load) return null;
		var state = s.getState();
		var active = null;
		state.routes = (state.routes || []).map(function (route) {
			if (route.id === state.activeRouteId) {
				route.style = Object.assign({}, route.style || {}, style);
				active = route;
			}
			return route;
		});
		if (!active && state.routes[0]) {
			state.routes[0].style = Object.assign({}, state.routes[0].style || {}, style);
			active = state.routes[0];
		}
		s.load({ routes: state.routes, activeRouteId: state.activeRouteId || (active && active.id) || 'route-main' });
		return { state: s.getState(), route: active };
	}
	function applyStylePreview() {
		updateActiveRouteStyle(formStyle());
	}
	function saveStyle() {
		if (!currentProjectId()) { status('Seleziona prima un progetto.', 'error'); return; }
		var result = updateActiveRouteStyle(formStyle());
		if (!result) { status('Route store non disponibile.', 'error'); return; }
		post('swm_admin_save_routes', { project_id: currentProjectId(), active_route_id: result.state.activeRouteId || 'route-main', routes: JSON.stringify(result.state.routes || []) }).then(function () {
			status('Stile salvato: ' + ((result.route && result.route.name) || 'route') + '.', 'success');
		}).catch(function (e) { status(e.message, 'error'); });
	}
	function boot() {
		mount();
		var s = store();
		if (s && s.on) s.on('change', function (event) { if (!event || !event.type || event.type !== 'route:loaded') render(); });
		if (!byId('swm-route-style-panel')) window.setTimeout(boot, 300);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})(window, document);
