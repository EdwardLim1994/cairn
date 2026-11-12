# Proposal

## Why

Backend responsibilities are spread across technical layers, and repositories directly reach into other domains. Focused modules and classes will make business rules easier to find and test without changing Cairn's behavior.

## What Changes

- Group backend code into responsibility-owned modules with explicit public entries and table ownership.
- Keep Nuxt API handlers and endpoint use cases as functions; convert services and repositories to focused classes, one class per TypeScript file.
- Inject active database or transaction instances into repositories. Coordinate cross-module work, including service deletion and mock API readiness, in one transaction.
- Keep `PROJECT_ID` scoping, MySQL, Drizzle, routes, payloads, and runtime behavior unchanged.
- Move migrated tests under each module's `_test_` directory, mirroring production paths.
- Do not add pub/sub, future microservice interfaces, database-per-user handling, or DuckDB migration.

## Capabilities

### New Capabilities

None. This is an internal, behavior-preserving refactor.

### Modified Capabilities

None.

## Impact

- Server use cases, repositories, domain services, route imports, transaction wiring, and their tests.
- No external API or database schema change. `skip_specs: true` records that no behavior contract changes.
