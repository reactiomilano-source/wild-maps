# RouteStore Core

RouteStore is the first JavaScript module for Wild Maps Route Editor 2.0.

## Purpose

The current editor stores route state in loose variables such as:

- `routeWaypoints`
- `routeGeojson`
- `routeMarkers`

RouteStore introduces a single owner for route state.

## Current scope

RouteStore is loaded in the admin area and exposed as `window.WildMapsRouteStore`.

The legacy editor still renders the map and list through `assets/js/admin.js`. During the migration, the bridge module keeps RouteStore synchronized with legacy route AJAX requests.

## Bridge module

`assets/js/route-editor/route-store-bridge.js` creates:

```js
window.WildMapsRouteEditorStore
```

The bridge watches the existing route AJAX flow:

- `swm_admin_get_route`
- `swm_admin_save_route`
- `swm_admin_ors_route`

This means RouteStore is now part of the editor execution path while the visual editor remains unchanged.

## Public API

```js
var store = new WildMapsRouteStore({
  route: geojson,
  waypoints: []
});
```

### Route methods

- `createRoute(route)`
- `setActiveRoute(routeId)`
- `getRoute(routeId)`
- `getActiveRoute()`
- `setRouteGeojson(routeId, geojson)`
- `clearRouteGeojson(routeId)`

### Waypoint methods

- `getWaypoints(routeId)`
- `setWaypoints(routeId, waypoints)`
- `addWaypoint(routeId, waypoint)`
- `insertWaypoint(routeId, index, waypoint)`
- `duplicateWaypoint(routeId, index)`
- `removeWaypoint(routeId, index)`
- `moveWaypoint(routeId, fromIndex, toIndex)`
- `reverseRoute(routeId)`
- `renameWaypoint(routeId, index, name)`

## Events

RouteStore emits event names that future UI modules can listen to:

- `route:loaded`
- `route:created`
- `route:activated`
- `route:geojson:set`
- `waypoints:set`
- `waypoint:added`
- `waypoint:inserted`
- `waypoint:removed`
- `waypoint:moved`
- `waypoint:renamed`
- `route:reversed`
- `legacy:sync`
- `legacy:request-sync`
- `change`

The generic `change` event fires after every specific event.

## Migration plan

1. Load RouteStore in admin. Done.
2. Wire existing single-route editor to RouteStore through the bridge. Done.
3. Replace direct mutations of `routeWaypoints` in `admin.js`.
4. Replace direct mutations of `routeGeojson` in `admin.js`.
5. Add a dedicated route list module.
6. Add multi-route UI.
7. Move route layer rendering to a dedicated route layer manager.
