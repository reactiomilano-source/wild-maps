# GPX Export: MultiTrack

Step 3.4C adds export for all routes as one GPX file containing multiple tracks.

## Behavior

The multi-route panel now includes:

```text
Export MultiTrack GPX
```

When clicked, Wild Maps:

1. Reads all routes from `WildMapsRouteEditorStore`.
2. Converts each exportable route into one GPX `trk`.
3. Skips empty routes without geometry or waypoints.
4. Includes route waypoints as GPX `wpt` elements.
5. Generates one file named `wild-maps-multitrack.gpx`.

## Output structure

```xml
<gpx>
  <metadata>...</metadata>
  <wpt>...</wpt>
  <trk>
    <name>Route 01</name>
    <trkseg>...</trkseg>
  </trk>
  <trk>
    <name>Route 02</name>
    <trkseg>...</trkseg>
  </trk>
</gpx>
```

## Notes

This export is useful for software that supports multiple tracks in a single GPX file, such as QGIS, GPX Studio, BaseCamp and many navigation apps.
