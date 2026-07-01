# .wmap Compatibility Model

Wild Maps 1.3 introduces a forward-compatible `.wmap` project shape while preserving Wild Maps 1.2 imports and the current editor data model.

## Legacy 1.2 shape

Wild Maps 1.2 exports a single-route project:

```json
{
  "wmap": "wild-maps-project",
  "format": "wmap",
  "format_version": "1.0",
  "project": {},
  "route": {},
  "stops": [],
  "poi": []
}
```

The route is stored in WordPress as:

- `_swm_route_geojson`
- `_swm_route_waypoints`

## Wild Maps 1.3 shape

Wild Maps 1.3 exports both the legacy keys and the new `routes` collection:

```json
{
  "wmap": "wild-maps-project",
  "format": "wmap",
  "format_version": "1.3",
  "project": {},
  "routes": [
    {
      "id": "route-main",
      "name": "Main route",
      "visible": true,
      "locked": false,
      "style": {
        "color": "#e63b2e",
        "width": 4,
        "opacity": 0.95
      },
      "geojson": {},
      "waypoints": []
    }
  ],
  "route": {},
  "stops": [],
  "poi": []
}
```

## Why keep `route` and `stops`?

During the 1.3 transition, the existing admin editor and frontend viewer still read the legacy single-route metadata. Keeping `route` and `stops` in exported files gives us two benefits:

- old-style imports remain easy to understand;
- the first route in a multi-route file can still be mapped back to the current editor without breaking the UI.

## Import rules

The importer accepts:

1. 1.2 single-route files with `route` and `stops`.
2. 1.3 files with a `routes` collection.

When importing a 1.3 file, the importer:

- stores the full route collection in `_swm_routes`;
- stores the first route in `_swm_route_geojson` and `_swm_route_waypoints` for current editor compatibility;
- imports POIs exactly like the 1.2 flow.

## Export rules

When exporting a project, the exporter:

- reads `_swm_routes` if present;
- otherwise creates a default `route-main` route from legacy route metadata;
- writes both `routes` and legacy `route` / `stops` keys.

## Next step

The next Route Editor 2.0 feature should start using `_swm_routes` as the canonical project route collection, while keeping the legacy fields updated until the frontend viewer has been migrated.
