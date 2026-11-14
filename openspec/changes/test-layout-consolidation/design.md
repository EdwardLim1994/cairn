# Design

## Context

See `proposal.md`. Existing tests span `app/`, `server/`, and `shared/`. `scripts/test-integration.mjs` recursively finds `*.integration.test.ts` under `server/`; `test:unit` excludes those files. The application uses SQLite for project data and DuckDB for telemetry. Integration tests use disposable database files and the existing integration runner; CI invokes the same runner without a separate MySQL service.

## Goals / Non-Goals

**Goals:** Give each module one predictable test location, preserve test intent, and keep all test commands and CI checks working.

**Non-Goals:** Add another database dialect, rewrite assertions solely for style, or change product behavior.

## Decisions

### Mirror production paths under one module-local `_test_`

For a production file `<module>/<relative-path>/<name>.ts`, place its test at `<module>/_test_/<relative-path>/<name>.test.ts`. Component tests use the same rule for `.vue` files. Keep route adapter tests with their owning backend module, mirroring the route path under that module's `_test_`. `app/pages` and Nuxt route directories remain framework entry points; modules own their behavior tests. Keep shared contract tests under a shared module's `_test_`.

Alternative: one repository-level test tree. Rejected because it separates tests from responsibility ownership and makes module moves harder.

### Relocate tests with feature and backend migrations, then sweep leftovers

`frontend-feature-modules` and `backend-modular-monolith` move tests alongside each migrated slice. This change handles remaining tests, import fixes, and consistency checks after those migrations. Avoid moving the same test twice. Preserve names ending in `.integration.test.ts` so the existing runner continues to discover them.

Alternative: move all tests first. Rejected because future module paths are not yet present and would cause a second move.

### Retain current test tiers and database engines

Keep unit/component tests fast with fakes where appropriate. Keep integration tests against disposable SQLite and DuckDB databases to cover SQL behavior, transaction rollback, telemetry persistence, and retry behavior. Preserve the current integration runner and CI workflow. Verify discovery and coverage paths after moves; change scripts only if actual test selection breaks.

Alternative: introduce MySQL for integration tests. Rejected because the application and existing integration tests use SQLite and DuckDB, and adding MySQL would require a separate schema and database setup without validating the current persistence engines.

## Risks / Trade-offs

- Relative imports and mocks can break after moves: update them per module and run focused tests before the next move.
- CI or coverage globs may miss relocated tests: verify test counts and discovered integration files before and after.
- Duplicate tests can remain during staged moves: remove old copies only after the relocated test passes.

## Migration Plan

1. Complete module moves in the frontend and backend changes, including their attached tests.
2. Inventory remaining tests and map each to an owning module and mirrored `_test_` path.
3. Relocate leftovers in small groups; update imports and mocks, then run focused tests.
4. Compare test discovery counts and run unit/component and SQLite/DuckDB integration suites in CI-compatible commands, followed by strict OpenSpec validation.
