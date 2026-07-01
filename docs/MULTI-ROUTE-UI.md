# Multi-route UI

`assets/js/route-editor/multi-route-ui.js` is the first visible UI step for multi-route projects.

## Current scope

This module adds a lightweight route switcher panel above the existing Route Stops card.

The user can:

- see the current active route;
- create a new route in the client RouteStore;
- switch active route in the client RouteStore;
- rename the active route in the client RouteStore.

## Compatibility

This step does not replace the current single-route editor behavior.

Existing projects still open as `Main route` / `route-main`.

## Limitation

Full persistence of all route collections is intentionally deferred to the next step.

For now, this is a safe UI layer that proves the multi-route interaction model without risking existing save/calculate behavior.

## Next step

Step 3.2 should add backend persistence endpoints for route collections and then connect create/select/rename/delete route to saved project data.
