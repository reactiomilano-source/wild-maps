# Route Layer Manager

This step adds the first route layer controls to the multi-route editor.

## Behavior

Each route row now has a visibility toggle:

```text
👁 visible
🚫 hidden
```

The toggle updates the route object's `visible` field and saves the route collection through the existing multi-route persistence endpoint.

## Stored data

Visibility is stored per route:

```json
{
  "id": "route-main",
  "name": "Main route",
  "visible": true
}
```

## Notes

This step manages route visibility state in the editor and data model.

A future rendering step can use this `visible` value to decide which route layers are drawn on the map.

## Safety

- Active route selection is preserved.
- Hidden routes can still be selected.
- Existing GPX import/export flows are unchanged.
