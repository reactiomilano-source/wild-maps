# Route Actions

`assets/js/route-editor/route-actions.js` adds the first visible Route Editor 2.0 waypoint actions.

## Added actions

- Duplicate waypoint
- Insert waypoint after the selected stop, between two existing stops

## Behavior

The module enhances the existing legacy waypoint list after it is rendered by `assets/js/admin.js`.

When a waypoint action is used, the module:

1. Reads the current waypoint list from the DOM.
2. Updates the waypoint array.
3. Clears the calculated route GeoJSON by saving an empty route with `allow_empty_route`.
4. Saves the updated waypoint list through the existing `swm_admin_save_route` endpoint.
5. Triggers the current project change event so the legacy editor reloads the route and redraws markers/list.

## Why this approach

This keeps the visible editor behavior stable while we continue moving route state toward RouteStore.

It avoids a large rewrite of `assets/js/admin.js` and lets the next PR migrate actions one at a time into dedicated modules.

## Current limitation

Inserted waypoints are placed at the geographic midpoint between two stops. The user can then drag the new stop to its exact position and recalculate the road route.
