(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }
	function store() { return window.WildMapsRouteEditorStore || null; }
	function currentProjectId() {
		var el = byId('swm-current-project');
		return el ? el.value : '';
	}
	function status(text, type) {
		var el = byId('swm-route-status') || byId('swm-gpx-import-status');
		if (!el) return;
		el.textContent = text || '';
		el.className = type ? 'is-' + type : '';
	}
	function saveRoutes(state, deletedRouteId) {
		if (!window.SWM_ADMIN || !currentProjectId()) return;
		var body = new URLSearchParams({
			action: 'swm_admin_save_routes',
			nonce: window.SWM_ADMIN.nonce || '',
			project_id: currentProjectId(),
			active_route_id: state.activeRouteId || '',
			routes: JSON.stringify(state.routes || [])
		});
		fetch(window.SWM_ADMIN.ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		}).then(function (response) {
			return response.json();
		}).then(function (json) {
			if (!json || !json.success) throw new Error((json && json.data && json.data.message) || 'Route delete error.');
			var s = store();
			if (s && s.load) {
				s.load({ routes: json.data.routes || state.routes || [], activeRouteId: json.data.active_route_id || state.activeRouteId || '' });
			}
			window.dispatchEvent(new CustomEvent('swm:route-deleted', { detail: { routeId: deletedRouteId || '', activeRouteId: state.activeRouteId || '' } }));
			status('Route deleted.', 'success');
		}).catch(function (error) {
			status(error.message, 'error');
		});
	}
	function deleteRoute(routeId) {
		var s = store();
		if (!s || !s.getState || !routeId) return;
		var state = s.getState();
		var routes = state.routes || [];
		var route = routes.find(function (item) { return item.id === routeId; });
		if (!route) return;
		if (!window.confirm('Delete route "' + (route.name || route.id) + '"?')) return;
		var nextRoutes = routes.filter(function (item) { return item.id !== routeId; });
		var nextActiveId = state.activeRouteId === routeId ? ((nextRoutes[0] && nextRoutes[0].id) || '') : state.activeRouteId;
		if (!nextRoutes.length) nextActiveId = '';
		if (s.load) s.load({ routes: nextRoutes, activeRouteId: nextActiveId });
		window.dispatchEvent(new CustomEvent('swm:route-deleted', { detail: { routeId: routeId, activeRouteId: nextActiveId } }));
		saveRoutes({ routes: nextRoutes, activeRouteId: nextActiveId }, routeId);
	}
	function mountButtons() {
		var panel = byId('swm-multi-route-panel');
		if (!panel) return;
		panel.querySelectorAll('.swm-route-layer-row').forEach(function (row) {
			if (row.querySelector('[data-route-delete-id]')) return;
			var routeButton = row.querySelector('[data-route-id]');
			if (!routeButton) return;
			var button = document.createElement('button');
			button.type = 'button';
			button.className = 'button button-link-delete';
			button.setAttribute('data-route-delete-id', routeButton.getAttribute('data-route-id'));
			button.textContent = 'Delete';
			row.appendChild(button);
		});
	}
	function bind() {
		var panel = byId('swm-multi-route-panel');
		if (!panel || panel.dataset.swmDeleteRouteBound) return;
		panel.dataset.swmDeleteRouteBound = '1';
		panel.addEventListener('click', function (event) {
			var target = event.target;
			var routeId = target && target.getAttribute('data-route-delete-id');
			if (!routeId) return;
			event.preventDefault();
			event.stopPropagation();
			deleteRoute(routeId);
		}, true);
		new MutationObserver(mountButtons).observe(panel, { childList: true, subtree: true });
	}
	function boot() {
		mountButtons();
		bind();
		window.setTimeout(boot, 500);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})(window, document);
