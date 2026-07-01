# Wild Maps 1.3 Roadmap

Main objective: **Route Editor 2.0**.

This release turns Wild Maps from a single-route WordPress map plugin into a project-based route engine ready for multi-route projects, route layers, plugin-owned styling and future web app reuse.

## Workflow

```text
main
  stable public releases

develop
  integration branch for next release

feature/*
  one technical feature per branch

release/1.3.0
  final stabilization before merging to main
```

## Phase 0: Audit and architecture

Status: in progress.

- [x] Verify GitHub access.
- [x] Confirm `develop` branch exists.
- [x] Create audit branch.
- [x] Review plugin bootstrap.
- [x] Review main PHP plugin class.
- [x] Review admin route editor JavaScript.
- [x] Review `.wmap` data shape.
- [x] Create architecture audit document.
- [ ] Open PR from `docs/audit-1.3-phase-0` into `develop`.
- [ ] Merge audit docs into `develop`.

## Phase 1: Compatibility and version alignment

Branch: `feature/1.3-version-and-compat`

- [ ] Align plugin header version with current stable baseline.
- [ ] Align `SWM_VERSION` constant.
- [ ] Add 1.3 development version marker.
- [ ] Define `.wmap` format migration rules.
- [ ] Add legacy single-route adapter.
- [ ] Confirm import of 1.2 `.wmap` projects still works.

## Phase 2: RouteStore core

Branch: `feature/route-store-core`

- [ ] Create RouteStore module.
- [ ] Move route state out of loose globals.
- [ ] Add waypoint methods:
  - [ ] add
  - [ ] insert
  - [ ] duplicate
  - [ ] remove
  - [ ] move
  - [ ] reverse
  - [ ] rename
- [ ] Keep existing UI behavior unchanged during migration.
- [ ] Add automatic renumbering through RouteStore state.

## Phase 3: Route Editor 2.0 UI

Branch: `feature/route-editor-2-ui`

- [ ] Improve drag & drop tappe.
- [ ] Add duplicate tappa.
- [ ] Add insert tappa between two points.
- [ ] Add clearer delete controls.
- [ ] Improve reverse route flow.
- [ ] Add dirty-state messaging: edited, needs recalculation, saved.
- [ ] Preserve current ORS calculation flow.

## Phase 4: Multi-route projects

Branch: `feature/multi-route-projects`

- [ ] Introduce route collection in project data.
- [ ] Add active route selection.
- [ ] Add create route.
- [ ] Add duplicate route.
- [ ] Add delete route.
- [ ] Add rename route.
- [ ] Store route visibility.
- [ ] Keep default legacy route as `route-main`.

## Phase 5: Route layers

Branch: `feature/route-layers`

- [ ] Create one MapLibre source/layer group per route.
- [ ] Toggle route visibility.
- [ ] Add route lock state.
- [ ] Add layer ordering.
- [ ] Ensure map bounds include visible routes only when requested.

## Phase 6: Style Manager

Branch: `feature/style-manager`

- [ ] Move route color into project data.
- [ ] Move route width into project data.
- [ ] Move route opacity into project data.
- [ ] Move marker/waypoint style into project data where needed.
- [ ] Update `.wmap` export.
- [ ] Update `.wmap` import.
- [ ] Reduce Elementor widget styling responsibility.

## Phase 7: Distance Engine

Branch: `feature/distance-engine`

- [ ] Calculate route GeoJSON length.
- [ ] Calculate straight-line fallback length.
- [ ] Calculate per-leg distances.
- [ ] Show total distance in Route Editor.
- [ ] Prepare distance data for roadbook output.

## Phase 8: Code cleanup

Branch: `feature/1.3-cleanup`

- [ ] Split admin JavaScript into modules or clearly separated sections.
- [ ] Extract PHP managers from `class-swm-plugin.php`.
- [ ] Remove dead code.
- [ ] Normalize Italian/English admin copy.
- [ ] Add developer notes.
- [ ] Final manual regression test.

## Release candidate

Branch: `release/1.3.0`

- [ ] Test project creation.
- [ ] Test POI CRUD.
- [ ] Test route creation.
- [ ] Test drag/drop.
- [ ] Test duplicate/delete/insert/reverse.
- [ ] Test multi-route.
- [ ] Test route layers.
- [ ] Test `.wmap` import from 1.2.
- [ ] Test `.wmap` export from 1.3.
- [ ] Test Elementor frontend rendering.
- [ ] Update README.
- [ ] Update CHANGELOG.
- [ ] Merge to main.
- [ ] Tag `v1.3.0`.
