# Wild Maps 1.3.0 Beta 1

Beta release for selected tour operator testing.

## Main beta features

- Multi-route projects
- GPX multi-file import
- GPX active route export
- GPX ZIP export
- GPX MultiTrack export
- Route visibility controls
- Route styling controls
- Active-route editor isolation
- Multi-route wmap import and export

## Known limitations

- KML, KMZ, CSV and GeoJSON import/export are not included.
- UI is functional but not final.
- Advanced layer groups are not included.
- Dash/dotted route styles and z-index are planned later.

## Tour operator test script

Create one real itinerary with at least 3 daily routes.

Checklist:

- [ ] Create a new map project.
- [ ] Import 3 or more GPX files.
- [ ] Rename every route by day.
- [ ] Change color, width and opacity for at least 2 routes.
- [ ] Hide and show one route.
- [ ] Edit stops on one route and verify other routes do not change.
- [ ] Export active route GPX.
- [ ] Export all routes ZIP.
- [ ] Export MultiTrack GPX.
- [ ] Export wmap.
- [ ] Import the wmap into a new project.
- [ ] Confirm routes, styles, visibility and POI survive import.

## Feedback questions

- Is the route workflow understandable?
- Which export format is most useful?
- Do you need KML or CSV before stable release?
- Are route colors and visibility enough for daily itinerary planning?
- What would make this usable for a real client delivery?

## Release process

1. Merge beta prep into develop.
2. Smoke test locally on WordPress.
3. Merge develop into main.
4. Tag v1.3.0-beta.1.
5. Create GitHub release.
6. Attach plugin ZIP.
7. Share release link only with selected testers.
