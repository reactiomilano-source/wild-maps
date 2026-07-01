---
name: Bug report
description: Report a Wild Maps bug or regression
title: "Bug: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a Wild Maps bug. Please include enough detail to reproduce it.
  - type: input
    id: version
    attributes:
      label: Wild Maps version
      description: Example: 1.2.0, 1.3.0-dev
      placeholder: "1.3.0-dev"
    validations:
      required: true
  - type: input
    id: wordpress
    attributes:
      label: WordPress / PHP version
      placeholder: "WordPress 6.x, PHP 8.1"
    validations:
      required: false
  - type: dropdown
    id: area
    attributes:
      label: Area
      options:
        - Route Editor
        - POI Editor
        - Import / Export
        - Elementor Widget
        - Frontend Rendering
        - Roadbook
        - Other
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      description: Describe the exact clicks/files/actions needed to trigger the bug.
      placeholder: |
        1. Open...
        2. Click...
        3. Import...
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected result
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Actual result
    validations:
      required: true
  - type: textarea
    id: files
    attributes:
      label: Files / screenshots / notes
      description: Attach test GPX, KML, CSV, .wmap files or screenshots if useful.
    validations:
      required: false
