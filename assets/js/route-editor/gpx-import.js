(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }
	function status(text, type) {
		var el = byId('swm-route-status') || byId('swm-gpx-import-status');
		if (!el) return;
		el.textContent = text || '';
		el.className = type ? 'is-' + type : '';
	}
	function currentProjectId() {
		var el = byId('swm-current-project') || byId('swm-gpx-project');
		return el ? el.value : '';
	}
	function store() { return window.WildMapsRouteEditorStore || null; }
	function post(action, data) {
		var body = new URLSearchParams(Object.assign({ action: action, nonce: window.SWM_ADMIN ? window.SWM_ADMIN.nonce : '' }, data || {}));
		return fetch(window.SWM_ADMIN.ajaxUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: body.toString() }).then(function (r) { return r.json(); }).then(function (json) {
			if (!json || !json.success) throw new Error((json && json.data && json.data.message) || 'Import error.');
			return json.data;
		});
	}
	function text(node) { return node ? String(node.textContent || '').trim() : ''; }
	function point(node) {
		var lat = Number(node.getAttribute('lat'));
		var lon = Number(node.getAttribute('lon'));
		if (!isFinite(lat) || !isFinite(lon)) return null;
		return [Number(lon.toFixed(6)), Number(lat.toFixed(6))];
	}
	function parseGpx(xmlText, fileName) {
		var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
		if (doc.querySelector('parsererror')) throw new Error(fileName + ': GPX non valido.');
		var name = text(doc.querySelector('gpx > name')) || fileName.replace(/\.gpx$/i, '') || 'Imported GPX';
		var coords = [];
		var trackName = text(doc.querySelector('trk > name'));
		if (trackName) name = trackName;
		doc.querySelectorAll('trkpt').forEach(function (pt) { var p = point(pt); if (p) coords.push(p); });
		if (!coords.length) {
			var routeName = text(doc.querySelector('rte > name'));
			if (routeName) name = routeName;
			doc.querySelectorAll('rtept').forEach(function (pt) { var p = point(pt); if (p) coords.push(p); });
		}
		if (!coords.length) throw new Error(fileName + ': nessuna traccia GPX trovata.');
		var waypoints = [];
		doc.querySelectorAll('wpt').forEach(function (wpt) { var p = point(wpt); if (p) waypoints.push([p[0], p[1], text(wpt.querySelector('name')) || 'Waypoint']); });
		return {
			id: 'route-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(16).slice(2, 8),
			name: name,
			visible: true,
			locked: false,
			style: { color: '#e63b2e', width: 4, opacity: 0.95 },
			geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: name, source: 'gpx', file: fileName }, geometry: { type: 'LineString', coordinates: coords } }] },
			waypoints: waypoints
		};
	}
	function readFile(file) {
		return new Promise(function (resolve, reject) {
			var reader = new FileReader();
			reader.onload = function () { try { resolve(parseGpx(String(reader.result || ''), file.name)); } catch (e) { reject(e); } };
			reader.onerror = function () { reject(new Error(file.name + ': lettura file non riuscita.')); };
			reader.readAsText(file);
		});
	}
	function loadExistingRoutes(projectId) {
		return post('swm_admin_get_routes', { project_id: projectId }).catch(function () { return { active_route_id: 'route-main', routes: [] }; });
	}
	function saveRoutes(projectId, routes, activeRouteId) {
		return post('swm_admin_save_routes', { project_id: projectId, active_route_id: activeRouteId || (routes[0] && routes[0].id) || 'route-main', routes: JSON.stringify(routes || []) });
	}
	function importFiles(files) {
		var projectId = currentProjectId();
		if (!projectId) { status('Seleziona prima un progetto.', 'error'); return; }
		if (!files || !files.length) { status('Seleziona uno o più file GPX.', 'error'); return; }
		status('Import GPX in corso...', 'info');
		Promise.all(Array.prototype.slice.call(files).map(readFile)).then(function (newRoutes) {
			return loadExistingRoutes(projectId).then(function (data) {
				var routes = (data.routes || []).concat(newRoutes);
				return saveRoutes(projectId, routes, (newRoutes[0] && newRoutes[0].id) || data.active_route_id).then(function (saved) {
					var s = store();
					if (s && s.load) s.load({ routes: saved.routes || routes, activeRouteId: saved.active_route_id || ((newRoutes[0] && newRoutes[0].id) || 'route-main') });
					status('Import completato: ' + newRoutes.length + ' route GPX aggiunte.', 'success');
				});
			});
		}).catch(function (e) { status(e.message, 'error'); });
	}
	function projectSelectHtml() {
		var existing = byId('swm-current-project');
		if (existing) return '';
		return '<p><label><strong>Project ID</strong><br><input type="number" id="swm-gpx-project" class="regular-text" placeholder="ID progetto"></label></p>';
	}
	function mount() {
		if (byId('swm-gpx-import-panel')) return;
		var target = document.querySelector('.swm-admin-page') || document.querySelector('.wrap');
		if (!target || !/import|export/i.test(target.textContent || '')) return;
		var panel = document.createElement('div');
		panel.id = 'swm-gpx-import-panel';
		panel.className = 'swm-admin-project-card';
		panel.innerHTML = '<h2>Import GPX multi-route</h2><p class="description">Carica uno o più file GPX: ogni file diventa una route separata nello stesso progetto.</p>' + projectSelectHtml() + '<p><input type="file" id="swm-gpx-files" accept=".gpx,application/gpx+xml" multiple></p><p><button type="button" class="button button-primary" id="swm-gpx-import-button">Import GPX routes</button></p><p id="swm-gpx-import-status" class="description"></p>';
		target.appendChild(panel);
		byId('swm-gpx-import-button').addEventListener('click', function () { importFiles(byId('swm-gpx-files').files); });
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
	else mount();
})(window, document);
