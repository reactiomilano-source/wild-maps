(function (window, document) {
	'use strict';

	function updateBadges() {
		var version = window.SWM_ADMIN && window.SWM_ADMIN.version ? window.SWM_ADMIN.version : '1.3.0-dev';
		document.querySelectorAll('.swm-admin-page h1 span, .swm-studio-header h1 span, .swm-hero h1 span').forEach(function (badge) {
			if (badge.textContent && badge.textContent.indexOf('1.1.0-dev') !== -1) {
				badge.textContent = version;
			}
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', updateBadges);
	} else {
		updateBadges();
	}
})(window, document);
