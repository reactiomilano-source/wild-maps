(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }
	function store() { return window.WildMapsRouteEditorStore || null; }
	function esc(text) { return String(text || '').replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]); }); }
	function projectTitle() {
		var select = byId('swm-current-project');
		if (select && select.options && select.selectedIndex >= 0) {
			return select.options[select.selectedIndex].text || 'Wild Maps Project';
		}
		var h1 = document.querySelector('.swm-admin-page h1');
		return h1 ? h1.textContent : 'Wild Maps Project';
	}
	function visibleRoutes() {
		var s = store();
		var state = s && s.getState ? s.getState() : { routes: [] };
		return (state.routes || []).filter(function (route) { return route && route.visible !== false; });
	}
	function routeColor(route) {
		return route && route.style && route.style.color ? route.style.color : '#e63b2e';
	}
	function legendHtml(routes) {
		if (!routes.length) return '<p class="muted">No visible routes.</p>';
		return routes.map(function (route) {
			return '<div class="legend-row"><span class="legend-color" style="background:' + esc(routeColor(route)) + '"></span><span>' + esc(route.name || route.id || 'Route') + '</span></div>';
		}).join('');
	}
	function summaryHtml(routes) {
		return '<div class="summary"><strong>' + routes.length + '</strong><span>visible routes</span></div>';
	}
	function openLayout() {
		var routes = visibleRoutes();
		var title = projectTitle();
		var win = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
		if (!win) { window.alert('Popup blocked. Allow popups to open the Map Layout.'); return; }
		var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + ' - Map Layout</title>' +
			'<style>' +
			'@page{size:A4 landscape;margin:12mm;}*{box-sizing:border-box;}body{font-family:Arial,sans-serif;margin:0;color:#111;background:#f4f4f4;} .sheet{width:100%;min-height:100vh;background:white;padding:24px;display:grid;grid-template-rows:auto 1fr auto;gap:18px;} .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;} h1{margin:0;font-size:30px;letter-spacing:.02em;} .subtitle{margin-top:6px;color:#666;} .meta{text-align:right;color:#666;font-size:12px;} .map-box{border:2px solid #111;display:flex;align-items:center;justify-content:center;min-height:430px;background:linear-gradient(135deg,#f7f7f7,#e6e6e6);position:relative;overflow:hidden;} .map-placeholder{text-align:center;color:#333;} .map-placeholder strong{font-size:22px;display:block;margin-bottom:8px;} .north{position:absolute;right:22px;top:20px;border:1px solid #111;width:44px;height:56px;text-align:center;padding-top:6px;font-weight:bold;background:white;} .north:before{content:"▲";display:block;font-size:18px;} .scale{position:absolute;left:24px;bottom:20px;width:160px;border-bottom:5px solid #111;text-align:center;padding-bottom:8px;font-size:12px;background:rgba(255,255,255,.8);} .footer{display:grid;grid-template-columns:1fr auto;gap:24px;border-top:2px solid #111;padding-top:14px;} .legend{display:flex;gap:18px;flex-wrap:wrap;align-items:center;} .legend-title{font-weight:bold;margin-right:4px;} .legend-row{display:inline-flex;gap:8px;align-items:center;font-size:13px;} .legend-color{display:inline-block;width:18px;height:10px;border:1px solid #111;} .summary{border:1px solid #111;padding:8px 14px;text-align:center;min-width:120px;} .summary strong{display:block;font-size:22px;} .summary span{font-size:11px;text-transform:uppercase;color:#555;} .muted{color:#777;margin:0;} .printbar{position:fixed;right:16px;top:16px;background:#111;color:white;padding:10px 12px;border-radius:6px;font-size:13px;} .printbar button{margin-left:10px;} @media print{body{background:white}.printbar{display:none}.sheet{min-height:auto;padding:0}.map-box{min-height:145mm;}}' +
			'</style></head><body>' +
			'<div class="printbar">Map Layout Beta <button onclick="window.print()">Print / Save PDF</button></div>' +
			'<main class="sheet"><header class="header"><div><h1>' + esc(title) + '</h1><div class="subtitle">Wild Maps route layout</div></div><div class="meta">Generated ' + esc(new Date().toLocaleString()) + '<br>Wild Maps 1.3 beta</div></header>' +
			'<section class="map-box"><div class="north">N</div><div class="scale">automatic scale</div><div class="map-placeholder"><strong>MAP AREA</strong><span>Use browser print to save this layout as PDF.</span></div></section>' +
			'<footer class="footer"><div class="legend"><span class="legend-title">Legend</span>' + legendHtml(routes) + '</div>' + summaryHtml(routes) + '</footer></main>' +
			'</body></html>';
		win.document.open();
		win.document.write(html);
		win.document.close();
	}
	function mount() {
		var panel = byId('swm-multi-route-panel');
		if (!panel || byId('swm-map-layout-button')) return;
		var button = document.createElement('button');
		button.type = 'button';
		button.id = 'swm-map-layout-button';
		button.className = 'button';
		button.textContent = 'Map Layout';
		button.addEventListener('click', openLayout);
		var actions = panel.querySelector('p');
		if (actions) actions.appendChild(document.createTextNode(' '));
		if (actions) actions.appendChild(button);
		else panel.appendChild(button);
	}
	function boot() {
		mount();
		if (!byId('swm-map-layout-button')) window.setTimeout(boot, 300);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})(window, document);
