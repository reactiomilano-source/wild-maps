# Multi-route Persistence

Step 3.2 connects the multi-route UI to saved project data.

## Backend

`includes/Core/class-swm-route-collection-ajax.php` adds two admin endpoints:

- `swm_admin_get_routes`
- `swm_admin_save_routes`

Both endpoints require the existing Wild Maps admin nonce and edit permissions.

## Storage

Route collections are stored in project meta:

```text
_swm_routes
```

The first route is mirrored back to the legacy route meta keys:

```text
_swm_route_geojson
_swm_route_waypoints
```

This keeps the current frontend and roadbook code compatible while the editor gains multi-route support.

## UI

`assets/js/route-editor/multi-route-ui.js` now:

- loads route collections when a project is selected;
- saves route collections after creating a route;
- saves route collections after renaming a route;
- saves the active route id after switching route.

## Current limitation

This step persists the route collection metadata and empty routes. The following step should connect the active route editor so each route can own its own waypoint list and GeoJSON independently.
