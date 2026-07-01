# GPX Export: All Routes ZIP

Step 3.4B adds export for all routes as separate GPX files packaged into one ZIP archive.

## Behavior

The multi-route panel now includes:

```text
Export all GPX ZIP
```

When clicked, Wild Maps:

1. Reads all routes from `WildMapsRouteEditorStore`.
2. Converts each exportable route into one GPX file.
3. Skips empty routes without geometry or waypoints.
4. Names files with a numeric prefix and route slug.
5. Packages everything into `wild-maps-routes.zip`.

## Output example

```text
wild-maps-routes.zip
├── 01-windhoek-waterberg.gpx
├── 02-waterberg-etosha.gpx
└── 03-etosha-east.gpx
```

## Notes

This is a client-side ZIP export. The ZIP is generated without a backend endpoint.

## Next step

Step 3.4C should add export for all routes in one multi-track GPX file.
