# Wild Maps 1.3 Architecture Audit

Phase 0 audit for the Wild Maps 1.3 development cycle.

## Current baseline

The repository has an active `main` branch and an existing `develop` branch. Version documentation says 1.2.0 is the current stable release, while the main plugin header still reports `1.1.0-dev-ipcenter-fix`. Version metadata must be aligned before the 1.3 release work starts.

The current plugin is intentionally compact, but most responsibilities are concentrated in two files:

- `wild-maps.php`: plugin bootstrap and constants.
- `includes/class-swm-plugin.php`: custom post types, admin pages, settings, REST routes, AJAX handlers, import/export, routing, and rendering helpers.
- `assets/js/admin.js`: admin map UI, POI editing, route editing, OpenRouteService integration, deletion mode, drag/drop list handling, map snapshots.

## Current data model

### WordPress objects

Wild Maps currently uses two custom post types:

- `swm_map_project`
- `swm_map_point`

Project route data is stored in post meta:

- `_swm_route_geojson`
- `_swm_route_waypoints`

POIs are stored as individual `swm_map_point` posts with metadata for coordinates, category, icon, label, description, order and project id.

### Native `.wmap` format

The current `.wmap` payload exports a single project with:

- project metadata
- one route object
- one flat list of stops
- one flat list of POIs
- limited settings

This format is good for 1.2, but 1.3 needs a forward-compatible `format_version` that can contain multiple routes, route layers, route styles and measurement metadata while still importing 1.2 files.

## Current Route Editor state

The route editor already contains useful foundations:

- OpenRouteService route calculation.
- Waypoints saved separately from the calculated GeoJSON route.
- Route marker rendering.
- Right-click/delete mode for route stops.
- Reverse route.
- Drag/drop reorder inside the waypoint list.
- Automatic visual renumbering of route markers based on array order.

However, these behaviors are implemented directly inside `assets/js/admin.js`, with shared mutable globals such as `routeWaypoints`, `routeGeojson`, `routeMarkers`, `routeMode` and `deleteMode`. This makes the current implementation fast to evolve in the short term, but fragile for multi-route, undo/redo, layers and future web app reuse.

## Main technical risks

### 1. Monolithic PHP plugin class

`includes/class-swm-plugin.php` mixes many domains in one class:

- bootstrap hooks
- custom post type registration
- admin UI rendering
- REST endpoints
- AJAX endpoints
- ORS geocoding/routing
- import/export
- PDF/roadbook preparation

This is now the biggest bottleneck for maintainability.

### 2. Monolithic admin JavaScript

`assets/js/admin.js` currently owns the whole admin experience. Route editing, POI editing, list rendering, MapLibre layer management, search, snapshots and persistence all live in the same closure.

For Route Editor 2.0 the JS should be split into small modules:

- ProjectStore
- RouteStore
- RouteEditor
- RouteLayerManager
- RouteStyleManager
- DistanceEngine
- PoiEditor
- MapController
- ApiClient

### 3. Single-route project assumption

The current project schema assumes exactly one route per project. Multi-route support requires an internal route collection:

```json
{
  "routes": [
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
      "waypoints": [],
      "geojson": null,
      "distance": null
    }
  ]
}
```

### 4. Style split between plugin and Elementor

1.3 should move route style ownership into the project/plugin layer. The Elementor widget should become a viewer that receives project-defined styles instead of owning route styling logic.

### 5. Version drift

The repository documentation says 1.2.0 is stable, but the plugin header and `SWM_VERSION` still expose a 1.1.0 development string. This can confuse WordPress, changelog tracking, user testing and release packaging.

## Proposed target architecture for 1.3

### PHP

```text
includes/
  class-swm-plugin.php              bootstrap only
  Core/
    Project_Manager.php
    Route_Manager.php
    Poi_Manager.php
    Style_Manager.php
    Distance_Engine.php
  Admin/
    Admin_Menu.php
    Project_Studio.php
    Import_Export_Page.php
  Api/
    Rest_Controller.php
    Ajax_Controller.php
  ImportExport/
    Wmap_Importer.php
    Wmap_Exporter.php
    Gpx_Importer.php
    Gpx_Exporter.php
    Kml_Importer.php
    Kml_Exporter.php
    Csv_Importer.php
    Csv_Exporter.php
  Integrations/
    Elementor_Widget.php
    OpenRouteService_Client.php
```

### JavaScript

```text
assets/js/admin/
  api-client.js
  map-controller.js
  project-store.js
  route-store.js
  route-editor.js
  route-list.js
  route-layer-manager.js
  route-style-manager.js
  distance-engine.js
  poi-editor.js
  boot.js
```

The first 1.3 implementation can still be bundled manually through WordPress enqueue calls. A build step is optional and should not be introduced until the codebase actually needs one.

## Route Editor 2.0 implementation plan

### Step 1: Data adapter

Create a compatibility adapter that reads the current single-route meta keys and exposes them as a route collection in memory.

Legacy input:

```json
{
  "route": {},
  "waypoints": []
}
```

1.3 internal shape:

```json
{
  "routes": [
    {
      "id": "route-main",
      "name": "Main route",
      "waypoints": [],
      "geojson": {},
      "style": {}
    }
  ]
}
```

### Step 2: RouteStore

RouteStore should become the only owner of route state. UI actions must call RouteStore methods instead of mutating `routeWaypoints` directly.

Required methods:

- `addWaypoint(routeId, waypoint)`
- `insertWaypoint(routeId, index, waypoint)`
- `duplicateWaypoint(routeId, index)`
- `removeWaypoint(routeId, index)`
- `moveWaypoint(routeId, fromIndex, toIndex)`
- `reverseRoute(routeId)`
- `renameWaypoint(routeId, index, name)`
- `setRouteGeojson(routeId, geojson)`
- `clearRouteGeojson(routeId)`
- `getRouteDistance(routeId)`

### Step 3: Route layers

Each route should have its own MapLibre source/layer ids:

```text
swm-route-{routeId}
swm-route-{routeId}-line
swm-route-{routeId}-waypoints
swm-route-{routeId}-labels
```

### Step 4: Style ownership

Route styles should live inside project data and `.wmap`. Elementor should read these values when rendering.

### Step 5: Measurements

DistanceEngine should calculate:

- straight-line waypoint distance
- GeoJSON line distance
- per-leg distance
- total route distance

## Phase 0 conclusions

The codebase is small enough to refactor safely, but large enough that adding multi-route directly into the existing globals would become messy quickly. The best 1.3 strategy is not a full rewrite. It should be an incremental strangler refactor:

1. Keep existing admin UI working.
2. Add adapters around the current data model.
3. Move route state into RouteStore.
4. Add multi-route once state is no longer global.
5. Move style and measurements into project-owned data.

This preserves the working 1.2 behavior while giving 1.3 a proper engine.