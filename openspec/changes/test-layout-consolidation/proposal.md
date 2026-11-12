# Proposal

## Why

Tests currently sit beside production files across frontend and backend folders. A consistent module-local `_test_` path will make production code easier to browse while retaining focused, runnable checks.

## What Changes

- Move remaining unit, component, route, and integration tests into the owning module's single `_test_` directory, mirroring the main file's path within that module.
- Update relative imports and test discovery scripts or configuration only where relocation requires it.
- Keep fast unit/component tests separate from real-MySQL integration tests; use the existing GitHub Actions MySQL service and local disposable Compose service.
- Preserve test assertions, application behavior, and database schema.

## Capabilities

### New Capabilities

None. This changes test organization only.

### Modified Capabilities

None.

## Impact

- Test file paths, test imports, relevant test scripts and CI discovery. No product API or behavior change; `skip_specs: true` applies.
