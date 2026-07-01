(function (window) {
	'use strict';

	if (window.WildMapsMapCaptureInstalled) return;
	window.WildMapsMapCaptureInstalled = true;

	function patchMapLibre(lib) {
		if (!lib || !lib.Map || lib.Map.__wildMapsCaptured) return lib;
		var OriginalMap = lib.Map;
		function CapturedMap(options) {
			var map = new OriginalMap(options || {});
			try {
				var container = options && options.container;
				if (container === 'swm-admin-map' || (container && container.id === 'swm-admin-map')) {
					window.WildMapsAdminMap = map;
					window.dispatchEvent(new CustomEvent('wildmaps:admin-map-ready', { detail: { map: map } }));
				}
			} catch (e) {}
			return map;
		}
		CapturedMap.prototype = OriginalMap.prototype;
		Object.keys(OriginalMap).forEach(function (key) { CapturedMap[key] = OriginalMap[key]; });
		CapturedMap.__wildMapsCaptured = true;
		lib.Map = CapturedMap;
		return lib;
	}

	var current = window.maplibregl;
	try {
		Object.defineProperty(window, 'maplibregl', {
			configurable: true,
			get: function () { return current; },
			set: function (value) { current = patchMapLibre(value); }
		});
		if (current) current = patchMapLibre(current);
	} catch (e) {
		if (window.maplibregl) patchMapLibre(window.maplibregl);
	}
})(window);
