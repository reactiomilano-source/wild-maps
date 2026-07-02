# GPX Import Rebuild

This beta bugfix replaces the failed GPX import UX patch with a cleaner import flow.

## Behavior

- Empty projects stay empty.
- No automatic `Main route` is created in a project with no routes.
- GPX import creates one route per GPX file.
- Imported route geometry is preserved as track GeoJSON.
- GPX `wpt` elements become editable route stops.
- GPX `rtept` elements become editable route stops and are used as geometry fallback when no track exists.
- If a GPX has only a track and no stops, Wild Maps creates Start and Finish editable stops.
- The imported route becomes active immediately.
- The admin map tries to fit bounds around the imported track.

## Test scope

- New empty project opens with no route.
- Import GPX into the selected project.
- Imported stops appear in the stop editor and can be edited.
- Imported track stays visible.
- Map centers on the imported track.
