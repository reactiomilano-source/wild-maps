# GPX Export: Active Route

Step 3.4A adds GPX export for the currently active route.

## Behavior

The multi-route panel now includes:

```text
Export active GPX
```

When clicked, Wild Maps:

1. Reads the active route from `WildMapsRouteEditorStore`.
2. Converts the route GeoJSON `LineString` into GPX `trkpt` points.
3. Falls back to route waypoints if no line geometry is available.
4. Adds route waypoints as GPX `wpt` elements.
5. Generates a browser download named after the route.

## Output

The exported GPX contains:

- `metadata/name`
- `metadata/time`
- one `trk`
- one `trkseg`
- multiple `trkpt`
- optional `wpt` elements

## Scope

This is a client-side export. It does not require a backend endpoint.

## Next steps

- Export all routes as separate GPX files in a ZIP.
- Export all routes in one multi-track GPX file.
