# Map Layout Base

This beta step adds a lightweight print layout for tour operator testing.

## Behavior

The route editor gets a new button:

```text
Map Layout
```

Clicking it opens a print-friendly browser window with:

- project title
- map placeholder area
- north marker
- automatic scale placeholder
- visible route count
- automatic legend from visible routes
- route colors

The user can then use browser print and save as PDF.

## Scope

This first version intentionally avoids a heavy PDF engine or external dependencies.

## Limitations

- The map area is a layout placeholder in this first beta step.
- Real map canvas capture/export can be added later.
- Format is A4 landscape by default.

## Freeze rule

After this feature, 1.3 beta should accept only:

- bug fixes
- small UX improvements
- crash fixes
