(function (window, document) {
	'use strict';

	function byId(id) { return document.getElementById(id); }

	function syncProjectOptions(select) {
		var main = byId('swm-current-project');
		if (!main || !select) return;
		select.innerHTML = '';
		Array.prototype.slice.call(main.options || []).forEach(function (option) {
			var clone = document.createElement('option');
			clone.value = option.value;
			clone.textContent = option.textContent;
			clone.selected = option.selected;
			select.appendChild(clone);
		});
	}

	function selectProject(projectId) {
		var main = byId('swm-current-project');
		if (!main || !projectId || main.value === projectId) return;
		main.value = projectId;
		main.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function mount() {
		var panel = byId('swm-gpx-import-panel');
		if (!panel || byId('swm-gpx-project')) return false;

		var title = panel.querySelector('h2');
		if (title) title.textContent = 'Import GPX routes';

		var description = panel.querySelector('.description');
		if (description) description.textContent = 'Import one GPX or several GPX files. Each file becomes a separate route inside the selected project.';

		var fileInput = byId('swm-gpx-files');
		var projectRow = document.createElement('p');
		projectRow.innerHTML = '<label for="swm-gpx-project"><strong>Target project</strong></label><br><select id="swm-gpx-project" required></select>';
		if (fileInput && fileInput.parentNode) {
			panel.insertBefore(projectRow, fileInput.parentNode);
		} else {
			panel.insertBefore(projectRow, panel.firstChild.nextSibling);
		}

		var projectSelect = byId('swm-gpx-project');
		syncProjectOptions(projectSelect);
		projectSelect.addEventListener('change', function () { selectProject(projectSelect.value); });

		var main = byId('swm-current-project');
		if (main) {
			main.addEventListener('change', function () { syncProjectOptions(projectSelect); });
		}

		var fileRow = fileInput ? fileInput.parentNode : null;
		if (fileRow) {
			var label = document.createElement('label');
			label.setAttribute('for', 'swm-gpx-files');
			label.innerHTML = '<strong>GPX file(s)</strong><br>';
			fileRow.insertBefore(label, fileInput);
		}

		var button = byId('swm-gpx-import-button');
		if (button) {
			button.textContent = 'Import selected GPX';
			button.addEventListener('click', function () {
				if (projectSelect && projectSelect.value) selectProject(projectSelect.value);
			}, true);
		}

		return true;
	}

	function boot() {
		if (!mount()) window.setTimeout(boot, 250);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})(window, document);
