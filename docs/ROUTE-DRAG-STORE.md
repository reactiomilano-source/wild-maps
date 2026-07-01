# RouteStore Drag Module

`assets/js/route-editor/route-drag-store.js` is Step 2.3 of Route Editor 2.0.

## Purpose

The legacy editor already supports drag and drop inside `assets/js/admin.js`.

This module keeps that visible behavior but adds a RouteStore-driven persistence layer after each drop.

## Behavior

After a waypoint row is dropped:

1. The module waits briefly for the legacy list to update.
2. It reads the reordered waypoint list from the DOM.
3. It loads the reordered list into `window.WildMapsRouteEditorStore`.
4. It saves the reordered list through `swm_admin_save_route`.
5. It clears the stale calculated route by saving an empty route with `allow_empty_route`.

## Why this is safe

The module does not replace the existing drag handlers yet. It observes the existing UI and persists the resulting order.

This keeps the current editor stable while moving the execution path toward RouteStore.

## Next migration step

A future PR can move drag and drop rendering itself into a dedicated route list module.
