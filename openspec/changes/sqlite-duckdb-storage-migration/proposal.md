# Proposal

## Why

Cairn Personal runs as one application, but maintaining a MySQL service adds setup and test overhead. Its configuration and run metadata fit an embedded transactional database, while growing telemetry benefits from a separate analytical store.

## What Changes

- **BREAKING** Replace MySQL with a persistent SQLite file for application data, including projects, services, graph state, mock APIs, access tokens, runs, and call history. Existing MySQL data is not transferred; the new installation starts empty.
- Store OTLP spans and logs in a persistent DuckDB file. Keep project and trace identifiers across both stores so run flow, graph timing, and log views retain their current meaning.
- Create both database files and apply their schemas on first startup. Remove the MySQL container and connection configuration from Docker Compose.
- Make repeated OTLP delivery idempotent for spans and logs.
- Bound OTLP request and in-process write memory, batch telemetry writes to DuckDB, apply backpressure when saturated, and acknowledge only after durable writes. Compare ingestion throughput, latency, CPU, and memory before and after the migration.
- Expire DuckDB telemetry after an environment-configured age, defaulting to one year. Keep SQLite run and call history, and explicitly show when its telemetry has expired.
- Migrate repository integration tests to disposable SQLite and DuckDB databases. Complete this storage change before backend modularization; revise that separate change afterward.

## Capabilities

### New Capabilities

- `embedded-storage`: Initialize and persist the SQLite application store and DuckDB telemetry store for a single Cairn process.
- `telemetry-retention`: Ingest telemetry idempotently, expire it by age, and represent expired telemetry in retained run history.

### Modified Capabilities

None. The project has no durable capability specs yet.

## Impact

- Drizzle schema, migration configuration, database connection, repositories, OTLP ingestion, run flow and log queries, shared response contracts, and relevant UI states.
- Docker Compose, environment configuration, local development and CI integration tests, and database dependencies.
- The pending backend modular monolith design currently assumes MySQL and must be updated after this migration is specified.
