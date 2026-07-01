# RouteStore Core

RouteStore is the first JavaScript module for Wild Maps Route Editor 2.0.

## Purpose

The current editor stores route state in loose variables such as:

- `routeWaypoints`
- `routeGeojson`
- `routeMarkers`

RouteStore introduces a single owner for route state.

## Current scope

This first step adds the module and loads it in the admin area. The legacy editor still works as before. Future PRs will move one behavior at a time from `assets/js/admin.js` into RouteStore.

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
- `change`

The generic `change` event fires after every specific event.

## Migration plan

1. Load RouteStore in admin.
2. Wire existing single-route editor to RouteStore.
3. Replace direct mutations of `routeWaypoints`.
4. Replace direct mutations of `routeGeojson`.
5. Add multi-route UI.
6. Move route layer rendering to a dedicated route layer manager.
