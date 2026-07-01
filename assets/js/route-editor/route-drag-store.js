(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }
	function routeStatus(text, type) {
		var el = byId('swm-route-status');
		if (!el) return;
		el.textContent = text || '';
		el.className = type ? 'is-' + type : '';
	}
	function currentProjectId() {
		var el = byId('swm-current-project');
		return el ? el.value : '';
	}
	function parseWaypointRow(row) {
		var code = row.querySelector('code');
		var nameInput = row.querySelector('.swm-route-name');
		if (!code) return null;
		var parts = String(code.textContent || '').split(',');
		if (parts.length < 2) return null;
		var lat = Number(parts[0].trim());
		var lng = Number(parts[1].trim());
		if (!isFinite(lat) || !isFinite(lng)) return null;
		return [Number(lng.toFixed(6)), Number(lat.toFixed(6)), nameInput ? nameInput.value : ''];
	}
	function readWaypointsFromDom() {
		var list = byId('swm-route-waypoints-list');
		if (!list) return [];
		return Array.prototype.slice.call(list.querySelectorAll('li[data-index]')).map(parseWaypointRow).filter(Boolean);
	}
	function post(action, data) {
		var body = new URLSearchParams(Object.assign({ action: action, nonce: window.SWM_ADMIN ? window.SWM_ADMIN.nonce : '' }, data || {}));
		return fetch(window.SWM_ADMIN.ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		}).then(function (r) { return r.json(); }).then(function (json) {
			if (!json || !json.success) throw new Error((json && json.data && json.data.message) || 'Errore salvataggio.');
			return json.data;
		});
	}
	function syncAndPersistDrag() {
		var waypoints = readWaypointsFromDom();
		if (!waypoints.length || !currentProjectId()) return;
		if (window.WildMapsRouteEditorStore && window.WildMapsRouteEditorStore.load) {
			window.WildMapsRouteEditorStore.load({ route: null, waypoints: waypoints });
		}
		post('swm_admin_save_route', {
			project_id: currentProjectId(),
			route: '',
			waypoints: JSON.stringify(waypoints),
			allow_empty_route: '1'
		}).then(function () {
			routeStatus('Ordine tappe salvato. Ricalcola il percorso su strada.', 'success');
		}).catch(function (e) {
			routeStatus(e.message, 'error');
		});
	}
	function enhanceDragRows() {
		var list = byId('swm-route-waypoints-list');
		if (!list) return;
		Array.prototype.slice.call(list.querySelectorAll('li[data-index]')).forEach(function (row) {
			if (row.getAttribute('data-swm-drag-store-ready') === '1') return;
			row.setAttribute('data-swm-drag-store-ready', '1');
			row.addEventListener('drop', function () {
				window.setTimeout(syncAndPersistDrag, 80);
			});
		});
	}
	function init() {
		var list = byId('swm-route-waypoints-list');
		if (!list || !window.SWM_ADMIN || !window.fetch) return;
		enhanceDragRows();
		var observer = new MutationObserver(function () { enhanceDragRows(); });
		observer.observe(list, { childList: true, subtree: true });
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})(window, document);
