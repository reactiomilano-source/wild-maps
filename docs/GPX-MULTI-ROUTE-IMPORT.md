# GPX Multi-route Import

Step 3.3 adds the first GPX import workflow for Wild Maps 1.3.

## Behavior

Inside the Route Editor, the multi-route panel now includes a GPX import box.

The user can:

- select one project;
- upload one or more `.gpx` files;
- import each GPX as a separate route;
- preserve existing routes in the same project.

## Supported GPX data

The importer reads GPX client-side and supports:

- `trk/trkseg/trkpt` as route geometry;
- `rte/rtept` as fallback route geometry;
- `wpt` as route waypoints.

Each imported GPX becomes one Wild Maps route object with:

- `id`
- `name`
- `visible`
- `locked`
- `style`
- `geojson`
- `waypoints`

## Storage

Imported routes are appended to the existing route collection and saved through:

```text
swm_admin_save_routes
```

The collection is stored in:

```text
_swm_routes
```

The first route remains mirrored to the legacy route meta for compatibility.

## Notes

This step focuses on importing GPX into the multi-route model. Export GPX is a separate follow-up step.
