# Design

## Context

See `proposal.md`. Routes already delegate to endpoint use-case functions and repository functions. `server/repositories/services/index.ts` updates service data and graph positions, then calls mock API readiness code. Environment-variable and graph-code repositories also call readiness code directly. MySQL, Drizzle, `PROJECT_ID`, and current API contracts remain in place.

## Goals / Non-Goals

**Goals:** Make each responsibility and its table ownership clear; use focused classes for service and repository behavior; preserve atomic cross-module changes and external behavior.

**Non-Goals:** Prepare deployable microservices, add pub/sub, introduce a database abstraction for DuckDB, change project scoping, or redesign schema and routes.

## Decisions

### Organize server modules by responsibility

Use modules for project/access, service registry, message destinations, graph/canvas, mock APIs and templates, and observability/runs. Assign each table one owning module; graph owns node positions and edges, service registry owns services and endpoints, and mock APIs own readiness. Keep generic database connection, shared contracts, and transport helpers in infrastructure or Nuxt `shared/` as appropriate. Each module has a small `index.ts` public entry; other modules do not import its internal repositories or query its tables. Internal files use direct relative imports.

Alternative: retain technical folders and add barrels. Rejected because exports alone do not reveal ownership or stop cross-domain queries.

### Use focused classes for repositories and domain services

Each repository or domain service class occupies one TypeScript file and has one responsibility. Constructors receive required dependencies, including the current Drizzle database or transaction for repositories. Keep Nuxt route handlers and endpoint use cases as functions. Use-case dependencies name only required methods so tests can provide small fakes. Avoid an all-purpose module facade, class-per-endpoint use case, inheritance hierarchy, or a global service container.

Alternative: wrap every current function in a one-method class. Rejected because it adds ceremony without grouping related state or behavior.

### Coordinate cross-module writes in one use case and transaction

An endpoint use case opens or receives a transaction, creates transaction-bound repository instances for each participating module, and invokes public module operations in a defined order. Service deletion coordinates service removal, graph position removal, and mock API readiness reconciliation before commit. The same pattern applies to service update, environment-variable changes, and graph-code application when they affect readiness. A failure in any step rolls back the whole transaction. Module internals own their SQL; the coordinator owns the workflow. Preserve file-storage cleanup ordering where current service code handles proto files outside the database transaction.

Alternative: publish an in-process event on deletion. Rejected because an event emitter does not await asynchronous database work and cannot guarantee atomicity.

### Keep MySQL-specific persistence until a separate migration

Repositories accept the actual Drizzle MySQL connection or transaction type. Keep migrations and schema in MySQL form. Do not add a generic database interface for future database-per-user or DuckDB work. Those changes need their own data and concurrency design.

Alternative: implement a dialect-neutral adapter now. Rejected because the future storage contract is undecided.

### Move tests with modules

Put each module's unit and integration tests in one `_test_` directory, mirroring production paths. Use small fakes for use-case and class coordination. Keep focused real-MySQL tests for queries, ownership checks, and cross-module rollback; preserve HTTP contract tests for routes. The existing GitHub Actions integration workflow already supplies disposable MySQL for those tests.

## Risks / Trade-offs

- Shared transaction types can leak SQL ownership: pass transaction-bound module operations, not raw table access, across public entries.
- Mechanical class conversion can create boilerplate: group methods by actual responsibility and keep pure stateless transformations as functions.
- Reordering deletion and readiness work can change outcomes: characterize current behavior and test rollback and project isolation before moving code.
- Proto file cleanup spans database and filesystem: retain current compensation behavior and test failure paths.

## Migration Plan

1. Inventory tables, current cross-module imports, and API behavior; define ownership and public operations.
2. Move one vertical path at a time, starting with service CRUD and graph positions, while preserving route/use-case function signatures where practical.
3. Convert focused repositories and domain services to transaction-injected classes; move their tests into module `_test_` directories.
4. Move message destinations, mock APIs/templates, and observability/runs; replace direct cross-module repository imports with public operations.
5. Verify project scoping, API compatibility, cross-module rollback, focused MySQL integration tests, `vp check`, `vp run build`, and strict OpenSpec validation.
