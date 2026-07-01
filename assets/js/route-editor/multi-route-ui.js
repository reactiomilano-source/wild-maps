(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }
	function esc(text) { return String(text || '').replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]); }); }
	function xml(text) { return String(text || '').replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[m]); }); }
	function slug(text) { return String(text || 'route').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'route'; }
	function status(text, type) {
		var el = byId('swm-route-status') || byId('swm-gpx-import-status');
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
	function activeRoute() {
		var state = getState();
		return state.routes.find(function (route) { return route.id === state.activeRouteId; }) || state.routes[0];
	}
	function activeRouteName() {
		var active = activeRoute();
		return active ? active.name : 'Main route';
	}
	function render() {
		var panel = byId('swm-multi-route-panel');
		if (!panel) return;
		var state = getState();
		panel.querySelector('.swm-multi-route-list').innerHTML = state.routes.map(function (route) {
			var active = route.id === state.activeRouteId;
			var visible = route.visible !== false;
			return '<span class="swm-route-layer-row" style="display:inline-flex;gap:4px;align-items:center;margin:0 6px 6px 0;opacity:' + (visible ? '1' : '.45') + '"><button type="button" class="button" data-route-visibility-id="' + esc(route.id) + '" title="Toggle visibility">' + (visible ? '👁' : '🚫') + '</button><button type="button" class="button ' + (active ? 'button-primary' : '') + '" data-route-id="' + esc(route.id) + '">' + esc(route.name || route.id) + '</button></span>';
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
		var route = s.createRoute({ name: String(name || '').trim() || ('Route ' + (state.routes.length + 1)), waypoints: [], geojson: null, visible: true });
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
	function toggleRouteVisibility(routeId) {
		var s = ensureStore();
		if (!s || !s.getState || !routeId) return;
		var state = s.getState();
		var changed = null;
		state.routes = (state.routes || []).map(function (route) {
			if (route.id === routeId) { route.visible = route.visible === false; changed = route; }
			return route;
		});
		s.load({ routes: state.routes, activeRouteId: state.activeRouteId || routeId });
		render();
		saveRoutes(changed ? ((changed.visible !== false ? 'Route visibile: ' : 'Route nascosta: ') + (changed.name || changed.id) + '.') : 'Visibilità route aggiornata.');
	}
	function nodeText(node) { return node ? String(node.textContent || '').trim() : ''; }
	function gpxPoint(node) {
		var lat = Number(node.getAttribute('lat'));
		var lon = Number(node.getAttribute('lon'));
		if (!isFinite(lat) || !isFinite(lon)) return null;
		return [Number(lon.toFixed(6)), Number(lat.toFixed(6))];
	}
	function parseGpx(xmlText, fileName) {
		var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
		if (doc.querySelector('parsererror')) throw new Error(fileName + ': GPX non valido.');
		var name = nodeText(doc.querySelector('gpx > name')) || fileName.replace(/\.gpx$/i, '') || 'Imported GPX';
		var coords = [];
		var trackName = nodeText(doc.querySelector('trk > name'));
		if (trackName) name = trackName;
		doc.querySelectorAll('trkpt').forEach(function (pt) { var p = gpxPoint(pt); if (p) coords.push(p); });
		if (!coords.length) {
			var routeName = nodeText(doc.querySelector('rte > name'));
			if (routeName) name = routeName;
			doc.querySelectorAll('rtept').forEach(function (pt) { var p = gpxPoint(pt); if (p) coords.push(p); });
		}
		if (!coords.length) throw new Error(fileName + ': nessuna traccia GPX trovata.');
		var waypoints = [];
		doc.querySelectorAll('wpt').forEach(function (wpt) { var p = gpxPoint(wpt); if (p) waypoints.push([p[0], p[1], nodeText(wpt.querySelector('name')) || 'Waypoint']); });
		return { id: 'route-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(16).slice(2, 8), name: name, visible: true, locked: false, style: { color: '#e63b2e', width: 4, opacity: 0.95 }, geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: name, source: 'gpx', file: fileName }, geometry: { type: 'LineString', coordinates: coords } }] }, waypoints: waypoints };
	}
	function readGpxFile(file) {
		return new Promise(function (resolve, reject) {
			var reader = new FileReader();
			reader.onload = function () { try { resolve(parseGpx(String(reader.result || ''), file.name)); } catch (e) { reject(e); } };
			reader.onerror = function () { reject(new Error(file.name + ': lettura file non riuscita.')); };
			reader.readAsText(file);
		});
	}
	function importGpxFiles(files) {
		if (!currentProjectId()) { status('Seleziona prima un progetto.', 'error'); return; }
		if (!files || !files.length) { status('Seleziona uno o più file GPX.', 'error'); return; }
		status('Import GPX in corso...', 'info');
		Promise.all(Array.prototype.slice.call(files).map(readGpxFile)).then(function (newRoutes) {
			return loadRoutes().then(function () {
				var state = getState();
				state.routes = (state.routes || []).concat(newRoutes);
				var activeId = newRoutes[0] ? newRoutes[0].id : state.activeRouteId;
				var s = ensureStore();
				if (s && s.load) s.load({ routes: state.routes, activeRouteId: activeId });
				return saveRoutes('Import completato: ' + newRoutes.length + ' route GPX aggiunte.');
			});
		}).catch(function (e) { status(e.message, 'error'); });
	}
	function routeCoordinates(route) {
		var features = route && route.geojson && Array.isArray(route.geojson.features) ? route.geojson.features : [];
		for (var i = 0; i < features.length; i++) {
			var geom = features[i].geometry || {};
			if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) return geom.coordinates;
			if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) return geom.coordinates.reduce(function (out, line) { return out.concat(line || []); }, []);
		}
		return [];
	}
	function routeTrackXml(route) {
		var name = route && route.name ? route.name : 'Wild Maps route';
		var coords = routeCoordinates(route);
		if (!coords.length && Array.isArray(route.waypoints)) coords = route.waypoints.map(function (wp) { return [wp[0], wp[1]]; });
		if (!coords.length) throw new Error('La route non contiene coordinate esportabili.');
		var trkpts = coords.map(function (c) { return '<trkpt lat="' + c[1] + '" lon="' + c[0] + '"></trkpt>'; }).join('\n');
		return '<trk><name>' + xml(name) + '</name><trkseg>\n' + trkpts + '\n</trkseg></trk>';
	}
	function routeWaypointXml(route) {
		return Array.isArray(route.waypoints) ? route.waypoints.map(function (wp) { return '<wpt lat="' + wp[1] + '" lon="' + wp[0] + '"><name>' + xml(wp[2] || 'Waypoint') + '</name></wpt>'; }).join('\n') : '';
	}
	function routeToGpx(route) {
		var name = route && route.name ? route.name : 'Wild Maps route';
		var now = new Date().toISOString();
		return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Wild Maps" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>' + xml(name) + '</name><time>' + now + '</time></metadata>\n' + routeWaypointXml(route) + '\n' + routeTrackXml(route) + '\n</gpx>\n';
	}
	function downloadBlob(filename, blob) {
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		window.setTimeout(function () { URL.revokeObjectURL(url); }, 500);
	}
	function downloadText(filename, content) {
		downloadBlob(filename, new Blob([content], { type: 'application/gpx+xml;charset=utf-8' }));
	}
	function exportActiveGpx() {
		try {
			var route = activeRoute();
			if (!route) throw new Error('Nessuna route attiva da esportare.');
			downloadText(slug(route.name || route.id) + '.gpx', routeToGpx(route));
			status('GPX esportato: ' + (route.name || route.id) + '.', 'success');
		} catch (e) { status(e.message, 'error'); }
	}
	function crc32(text) {
		var table = crc32.table || (crc32.table = (function () {
			var c, table = [];
			for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
			return table;
		})());
		var crc = -1;
		for (var i = 0; i < text.length; i++) crc = (crc >>> 8) ^ table[(crc ^ text.charCodeAt(i)) & 0xff];
		return (crc ^ -1) >>> 0;
	}
	function u16(n) { return String.fromCharCode(n & 255, (n >>> 8) & 255); }
	function u32(n) { return String.fromCharCode(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255); }
	function makeZip(files) {
		var local = '', central = '', offset = 0;
		files.forEach(function (file) {
			var name = file.name;
			var data = file.content;
			var crc = crc32(data);
			var localHeader = 'PK\x03\x04' + u16(20) + u16(0) + u16(0) + u16(0) + u16(0) + u32(crc) + u32(data.length) + u32(data.length) + u16(name.length) + u16(0) + name;
			local += localHeader + data;
			central += 'PK\x01\x02' + u16(20) + u16(20) + u16(0) + u16(0) + u16(0) + u16(0) + u32(crc) + u32(data.length) + u32(data.length) + u16(name.length) + u16(0) + u16(0) + u16(0) + u16(0) + u32(0) + u32(offset) + name;
			offset += localHeader.length + data.length;
		});
		return local + central + 'PK\x05\x06' + u16(0) + u16(0) + u16(files.length) + u16(files.length) + u32(central.length) + u32(local.length) + u16(0);
	}
	function exportAllGpxZip() {
		try {
			var state = getState();
			var files = [];
			(state.routes || []).forEach(function (route, index) {
				try {
					var prefix = String(index + 1).padStart(2, '0');
					files.push({ name: prefix + '-' + slug(route.name || route.id) + '.gpx', content: routeToGpx(route) });
				} catch (e) {}
			});
			if (!files.length) throw new Error('Nessuna route esportabile nel progetto.');
			downloadBlob('wild-maps-routes.zip', new Blob([makeZip(files)], { type: 'application/zip' }));
			status('ZIP GPX esportato: ' + files.length + ' route.', 'success');
		} catch (e) { status(e.message, 'error'); }
	}
	function exportMultiTrackGpx() {
		try {
			var state = getState();
			var tracks = [];
			var waypoints = [];
			(state.routes || []).forEach(function (route) {
				try {
					tracks.push(routeTrackXml(route));
					var wpt = routeWaypointXml(route);
					if (wpt) waypoints.push(wpt);
				} catch (e) {}
			});
			if (!tracks.length) throw new Error('Nessuna route esportabile nel progetto.');
			var now = new Date().toISOString();
			var gpx = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Wild Maps" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>Wild Maps MultiTrack</name><time>' + now + '</time></metadata>\n' + waypoints.join('\n') + '\n' + tracks.join('\n') + '\n</gpx>\n';
			downloadText('wild-maps-multitrack.gpx', gpx);
			status('GPX MultiTrack esportato: ' + tracks.length + ' route.', 'success');
		} catch (e) { status(e.message, 'error'); }
	}
	function mountGpxImport(panel) {
		if (!panel || byId('swm-gpx-import-panel')) return;
		var box = document.createElement('div');
		box.id = 'swm-gpx-import-panel';
		box.className = 'swm-admin-route-card swm-gpx-import-panel';
		box.innerHTML = '<h2>Import GPX multi-route</h2><p class="description">Carica uno o più GPX: ogni file diventa una route separata nello stesso progetto.</p><p><input type="file" id="swm-gpx-files" accept=".gpx,application/gpx+xml" multiple></p><p><button type="button" class="button" id="swm-gpx-import-button">Import GPX routes</button></p><p id="swm-gpx-import-status" class="description"></p>';
		panel.appendChild(box);
		byId('swm-gpx-import-button').addEventListener('click', function () { importGpxFiles(byId('swm-gpx-files').files); });
	}
	function mount() {
		var routeCard = document.querySelector('.swm-admin-route-card');
		if (!routeCard || byId('swm-multi-route-panel')) return;
		var panel = document.createElement('div');
		panel.id = 'swm-multi-route-panel';
		panel.className = 'swm-admin-route-card swm-multi-route-panel';
		panel.innerHTML = '<h2>Routes</h2><p class="description">Active route: <strong class="swm-multi-route-active">Main route</strong></p><div class="swm-multi-route-list"></div><p><button type="button" class="button button-primary" id="swm-route-create">+ New route</button> <button type="button" class="button" id="swm-route-rename">Rename active</button> <button type="button" class="button" id="swm-route-export-gpx">Export active GPX</button> <button type="button" class="button" id="swm-route-export-all-gpx">Export all GPX ZIP</button> <button type="button" class="button" id="swm-route-export-multitrack-gpx">Export MultiTrack GPX</button></p><p class="description">Route collection is saved in this project. Use the eye buttons to show or hide route layers.</p>';
		routeCard.parentNode.insertBefore(panel, routeCard);
		panel.addEventListener('click', function (event) {
			var target = event.target;
			if (target.id === 'swm-route-create') { event.preventDefault(); createRoute(); return; }
			if (target.id === 'swm-route-rename') { event.preventDefault(); renameActiveRoute(); return; }
			if (target.id === 'swm-route-export-gpx') { event.preventDefault(); exportActiveGpx(); return; }
			if (target.id === 'swm-route-export-all-gpx') { event.preventDefault(); exportAllGpxZip(); return; }
			if (target.id === 'swm-route-export-multitrack-gpx') { event.preventDefault(); exportMultiTrackGpx(); return; }
			if (target && target.getAttribute('data-route-visibility-id')) { event.preventDefault(); toggleRouteVisibility(target.getAttribute('data-route-visibility-id')); return; }
			if (target && target.getAttribute('data-route-id')) { event.preventDefault(); var s = ensureStore(); if (s && s.setActiveRoute) s.setActiveRoute(target.getAttribute('data-route-id')); render(); saveRoutes('Route attiva: ' + activeRouteName() + '.'); }
		});
		mountGpxImport(panel);
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
