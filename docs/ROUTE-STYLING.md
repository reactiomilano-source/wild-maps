# Route Styling Controls

This step adds per-route styling controls to the multi-route editor.

## UI

The multi-route panel now includes an active-route style panel with:

- color
- width
- opacity

The panel edits the currently active route.

## Stored data

Style is stored inside each route object:

```json
{
  "id": "route-main",
  "name": "Main route",
  "style": {
    "color": "#e63b2e",
    "width": 4,
    "opacity": 0.95
  }
}
```

## Preview and save

Changing a style input updates the route store immediately, so the map renderer can preview the change.

Clicking `Save style` persists the full route collection through:

```text
swm_admin_save_routes
```

## Rendering

The existing multi-route layer renderer already reads the route style fields and applies them to the line layer.

## Notes

This step intentionally focuses on color, width and opacity. Dash style and z-index can be added in a follow-up step without changing the storage model.
