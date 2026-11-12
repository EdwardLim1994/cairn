# Tasks

## 1. Embedded store foundation

- [ ] 1.1 Inventory every MySQL table, index, foreign key, JSON/timestamp mapping, raw SQL query, and repository call; record the SQLite/DuckDB ownership map and verify it covers all current schema objects.
- [ ] 1.2 Add SQLite and DuckDB dependencies, path configuration, and database lifecycle; verify `vp install`, config tests, and a writable first-run startup.
- [ ] 1.3 Create versioned SQLite and DuckDB schemas, startup migrations, foreign-key/WAL settings, and restart handling; verify fresh and repeated startup integration tests against disposable files.
- [ ] 1.4 Capture a reproducible pre-migration OTLP baseline with synthetic trace/log batches; record payload sizes, accepted records per second, p50/p95 response latency, peak RSS, CPU, and parse/write timings so the same workload can be rerun later.

## 2. Application persistence in SQLite

- [ ] 2.1 Convert project, service, endpoint, graph, message-destination, template, environment-variable, and token schemas and repositories to SQLite; verify their repository and route tests plus project isolation.
- [ ] 2.2 Convert mock API, run, and call-history schemas and transactions to SQLite; verify CRUD, run lifecycle, cascade/uniqueness, and rollback integration tests.
- [ ] 2.3 Replace MySQL-specific query results, upserts, JSON/date handling, and transaction types across remaining server code; verify relevant use-case and contract tests.

## 3. Telemetry in DuckDB

- [ ] 3.1 Add DuckDB span/log tables, indexes or query layout, and one owned connection lifecycle; verify fresh schema creation and restart persistence with real DuckDB tests.
- [ ] 3.2 Move span and log ingestion to bounded DuckDB bulk writes with span upsert and deterministic log identity; verify repeated OTLP batches create no duplicates and batch size stays within configured limits.
- [ ] 3.3 Move project-scoped log and run-flow reads to DuckDB and coordinate the SQLite `lastTelemetryAt` update after telemetry commit; verify cross-project trace isolation and retry after a simulated SQLite metadata failure.
- [ ] 3.4 Route Cairn-generated failure logs through the telemetry store; verify failed-run log and response behavior with focused tests.
- [ ] 3.5 Enforce configurable compressed and decompressed OTLP body limits while reading, returning HTTP 413 before an oversized body is fully buffered; verify both limits with route tests, including a high-expansion gzip payload.
- [ ] 3.6 Cap pending writer records and bytes, return a retryable response under saturation, and acknowledge only after DuckDB and required SQLite writes complete; verify concurrent load, write failure, retry, and shutdown behavior.
- [ ] 3.7 Rerun the baseline workload after migration and report throughput, p50/p95 latency, peak RSS, CPU, and parse/write timing against the recorded baseline; verify the report uses identical payloads and documents any regression.

## 4. Retention and history presentation

- [ ] 4.1 Add `TELEMETRY_RETENTION_DAYS` with a 365-day default, startup/daily cleanup, and write coordination; verify cutoff, delayed delivery, and retention config tests.
- [ ] 4.2 Expose expired or partially expired telemetry in run-flow contracts and UI without deleting SQLite history; verify saved-run history, graph timing, and no-telemetry scenarios.

## 5. Deployment and integration checks

- [ ] 5.1 Remove MySQL from Docker Compose and CI integration setup, mount a persistent app data volume, and document first-run and restart behavior; verify Compose configuration and container restart persistence.
- [ ] 5.2 Run `vp check`, `vp test`, `vp run build`, focused embedded-database integration tests, and `openspec validate sqlite-duckdb-storage-migration --strict`; verify existing routes and `PROJECT_ID` scoping remain correct.
