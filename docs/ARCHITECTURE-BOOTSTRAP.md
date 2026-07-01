# Architecture Bootstrap

This document defines the first safe architecture step for Wild Maps 1.3.

## Goal

Prepare the codebase for RouteStore Core and Route Editor 2.0 without rewriting the existing working plugin.

## Current state

The current plugin still uses:

- `wild-maps.php` as bootstrap;
- `includes/class-swm-plugin.php` as the main legacy plugin class;
- `includes/class-swm-wmap-compat.php` as the first 1.3 compatibility layer;
- `assets/js/admin.js` as the current admin editor script.

## New structure

The following folders are introduced as targets for incremental migration:

```text
includes/
  Core/
  Admin/
  Api/
  ImportExport/
  Integrations/

assets/js/route-editor/
```

## Loader

`includes/class-swm-loader.php` provides a tiny file loader used by `wild-maps.php`.

This keeps bootstrap loading centralized while avoiding a risky Composer/build-step change.

## Migration rule

Do not move large blocks of code blindly.

Instead:

1. create a new class or module;
2. route one responsibility through it;
3. keep legacy behavior working;
4. remove legacy code only after the new path is stable.

## Next step

Issue #10, RouteStore Core, should add the first real module under the new structure.
