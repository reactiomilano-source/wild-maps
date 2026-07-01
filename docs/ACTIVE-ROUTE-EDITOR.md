# Active Route Editor Isolation

This step makes the existing route editor operate on the currently active route from the multi-route collection.

## Behavior

The legacy editor actions are now routed to the active route:

- load route
- save route
- save waypoint-only draft
- clear route
- reverse stops
- calculate route

## Implementation

`Active_Route_Editor_Ajax` hooks into the existing AJAX actions at priority `1`:

```text
swm_admin_get_route
swm_admin_save_route
```

Because it responds with `wp_send_json_success()`, the older legacy callbacks do not run for these requests.

## Storage

Edits are saved into the active route object inside:

```text
_swm_routes
```

The active route id is read from:

```text
_swm_active_route_id
```

The full route collection is persisted through `Route_Collection::save_project_routes()`.

## Compatibility

`Route_Collection::save_project_routes()` still mirrors the first route into legacy route meta, preserving compatibility with existing frontend and roadbook flows.

## Acceptance checks

- Select Route A and edit stops.
- Select Route B and edit stops.
- Switch back to Route A: Route A should still have its own stops.
- Reload project: active route edits should persist.
