(function (window) {
	'use strict';

	if (window.__swmRouteLoadInitClean) return;
	window.__swmRouteLoadInitClean = true;

	function repaintMap() {
		try {
			var map = window.WildMapsAdminMap;
			if (map && map.resize) map.resize();
			window.dispatchEvent(new CustomEvent('wildmaps:admin-map-ready', { detail: { map: map } }));
		} catch (e) {}
	}

	function repaintLater() {
		window.setTimeout(repaintMap, 0);
		window.setTimeout(repaintMap, 150);
		window.setTimeout(repaintMap, 500);
	}

	window.addEventListener('wildmaps:routes-hydrated', repaintLater);
})(window);
