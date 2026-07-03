(function (window, document) {
	'use strict';

	window.SWM_ROUTE_MODE_ACTIVE = !!window.SWM_ROUTE_MODE_ACTIVE;

	function patchMapLibre() {
		if (!window.maplibregl || !window.maplibregl.Map || window.maplibregl.Map.prototype.__swmRouteClickGuard) return !!(window.maplibregl && window.maplibregl.Map);
		var proto = window.maplibregl.Map.prototype;
		var originalOn = proto.on;
		proto.__swmRouteClickGuard = true;
		proto.on = function (type, layerOrListener, listener) {
			if (type === 'click') {
				if (typeof layerOrListener === 'function') {
					var fn = layerOrListener;
					if (!fn.__swmActiveRouteStops) {
						layerOrListener = function (event) {
							if (window.SWM_ROUTE_MODE_ACTIVE) return;
							return fn.call(this, event);
						};
					}
				} else if (typeof listener === 'function' && !listener.__swmActiveRouteStops) {
					var originalLayerListener = listener;
					listener = function (event) {
						if (window.SWM_ROUTE_MODE_ACTIVE) return;
						return originalLayerListener.call(this, event);
					};
				}
			}
			return originalOn.call(this, type, layerOrListener, listener);
		};
		return true;
	}

	function bindButtonState() {
		var btn = document.getElementById('swm-route-mode');
		if (!btn || btn.__swmRouteModeGuardBound) return;
		btn.__swmRouteModeGuardBound = true;
		btn.addEventListener('click', function () {
			window.setTimeout(function () {
				window.SWM_ROUTE_MODE_ACTIVE = btn.classList.contains('button-primary') || /ON|attiva/i.test(btn.textContent || '');
			}, 0);
		}, true);
	}

	function boot() {
		patchMapLibre();
		bindButtonState();
		window.setTimeout(boot, 300);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window, document);
