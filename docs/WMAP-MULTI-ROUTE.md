# Multi-route .wmap

Wild Maps 1.3 extends the native `.wmap` project format so it can preserve a complete multi-route project.

## Exported fields

A 1.3 `.wmap` file includes:

```json
{
  "format_version": "1.3",
  "routes": [],
  "active_route_id": "route-main",
  "route": null,
  "stops": [],
  "poi": []
}
```

## Routes

Each route preserves:

- `id`
- `name`
- `visible`
- `locked`
- `style`
- `geojson`
- `waypoints`

## Backward compatibility

The legacy fields are still exported:

- `route`
- `stops`

They mirror the first route in the collection so older consumers can still read a single route.

## Import

Import accepts both shapes:

- new multi-route `.wmap` files with `routes`
- older single-route `.wmap` files with `route` and `stops`

Imported projects are created as new projects. Existing projects are not overwritten.
