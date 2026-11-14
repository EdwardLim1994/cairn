# Proposal

## Why

Cairn's shared colors and control styles are spread across global CSS, component utilities, and Nuxt UI overrides. A theme change now requires edits in many places and can leave light and dark views inconsistent.

## What Changes

- Make the existing light and dark palettes the reference for a single Nuxt UI and Tailwind theme foundation.
- Standardize shared control colors, sizes, spacing, and states through Nuxt UI theme configuration and named tokens.
- Consolidate shared side-drawer and card structure while preserving panel and button positions, graph behavior, and current workflows.
- Place tests for each migrated frontend module under its `__test__` directory, mirroring production paths.
- Keep feature organization, editor workflow changes, and panel lazy loading in later frontend slices.

## Capabilities

### New Capabilities

- `frontend-theme`: Shared light and dark appearance for Cairn controls, surfaces, and reusable panel structure.

### Modified Capabilities

None.

## Impact

- Frontend theme CSS, Nuxt UI app configuration, shared drawer and card components, and their tests.
- No API, database schema, dependency, panel-position, or graph-behavior change.
