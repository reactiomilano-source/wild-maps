# Route Visibility Rendering

This step connects the saved multi-route visibility state to the admin map.

## Files

- `assets/js/route-editor/route-map-capture.js`
- `assets/js/route-editor/route-layer-renderer.js`

## Behavior

`route-map-capture.js` captures the MapLibre admin map instance and exposes it as:

```js
window.WildMapsAdminMap
```

`route-layer-renderer.js` listens to `WildMapsRouteEditorStore` and renders visible routes on the admin map.

## Route visibility

Only routes with:

```json
"visible": true
```

or no explicit `visible: false` value are rendered.

Hidden routes are skipped by the renderer.

## Rendering

The renderer creates dedicated MapLibre sources and layers:

- `swm-admin-routes-visible`
- `swm-admin-routes-visible-lines`
- `swm-admin-routes-visible-points`
- `swm-admin-routes-visible-labels`

This keeps the existing single-route editor layer untouched.

## Safety

The existing route editor still owns the legacy single-route layer. This step only adds an additional multi-route renderer for visible routes from the route collection.
