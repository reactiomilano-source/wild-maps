# Multi-route Core

Wild Maps 1.3 introduces a route collection data model.

## Compatibility route

Existing projects use two legacy meta keys:

- `_swm_route_geojson`
- `_swm_route_waypoints`

The multi-route model maps those values into a default route:

```text
route-main
```

This keeps all current editor, frontend and roadbook behavior compatible.

## New project meta

Multi-route collections are stored in:

```text
_swm_routes
```

The stored value is a JSON array of route objects.

## Route object shape

```json
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
  "geojson": null,
  "waypoints": []
}
```

## Sync rule

For compatibility, the first route in the collection is mirrored back into the legacy meta keys.

This means:

- old code still reads the main route;
- new code can read the full route collection;
- future UI can add multiple routes without changing storage again.

## Next step

Step 3.1 will add UI controls to create, select and rename routes inside the project editor.
