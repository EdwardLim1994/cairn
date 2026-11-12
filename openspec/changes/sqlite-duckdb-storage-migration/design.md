# Design

## Context

See `proposal.md`. The current Drizzle schema and repositories use MySQL. `runs` and call history contain request and response state; `spans` and `logs` hold OTLP telemetry. Run flow reads spans by project and trace ID. Trace ingestion inserts spans, then updates `runs.lastTelemetryAt`. Cairn Personal runs as one app process, and existing MySQL records may be discarded.

## Goals / Non-Goals

**Goals:** Preserve project isolation and existing API behavior while using embedded stores; make first-run startup, retry handling, expiry, and integration tests deterministic; bound ingestion memory and measure its throughput, latency, CPU, and memory use.

**Non-Goals:** Import MySQL records, use Parquet, share the database files across replicas, redesign project scoping, add Bun workers or a separate ingestion service without measured need, or implement the separate backend modularization change.

## Decisions

### Split ownership by workload

SQLite owns all existing tables except `spans` and `logs`. DuckDB owns those two telemetry tables. Keep `runs.lastTelemetryAt` in SQLite as the durable indication that telemetry was accepted. Join across stores in the run use case using `(projectId, traceId)`, never through a cross-database SQL join. All DuckDB reads include `projectId`; trace ID alone is insufficient.

Alternative: place everything in SQLite. Rejected because telemetry is append-heavy and the user chose DuckDB for telemetry queries. Alternative: put runs in DuckDB too. Rejected because run status and call history are transactional application state.

### Initialize durable files before serving requests

Configure a persistent data directory and explicit paths for `cairn.sqlite` and `telemetry.duckdb`. On startup, create the directory if needed, open both files, apply SQLite migrations and versioned DuckDB schema changes, then begin serving requests. Fail startup if either store cannot initialize. Use one persistent Docker volume mounted at the data directory; leave proto storage separately configured. Remove the MySQL service and `DATABASE_URL` from Compose and supply path configuration instead.

Use SQLite foreign keys, WAL mode, and a bounded busy timeout. Convert MySQL enums to constrained text, booleans to integers, JSON to serialized text with the same application types, and timestamps to a consistent UTC representation. Preserve cascade and uniqueness rules and review raw SQL for dialect differences. Drizzle manages SQLite schema and migrations; DuckDB telemetry schema is versioned independently. Existing MySQL migrations remain historical and are not replayed against SQLite.

Alternative: create tables lazily on first request. Rejected because a partially initialized app could accept requests. Alternative: share SQLite and DuckDB files across app replicas. Out of scope for this single-process project.

### Keep OTLP ingestion idempotent across stores

For spans, use unique `(project_id, trace_id, span_id)` and an upsert that updates the current record. For logs, compute a deterministic identity from project ID, canonicalized OTLP resource/scope/batch content, and record position; keep it as a unique column. Retrying an identical batch therefore does not duplicate logs. This also collapses an intentionally repeated byte-identical batch, a known limit because OTLP log records have no universal event ID.

Commit each telemetry batch to DuckDB before updating `runs.lastTelemetryAt` in SQLite. The two files cannot share a transaction. If the SQLite update fails, return an ingestion error; retrying the batch safely repeats the DuckDB upsert and can complete the metadata update. Keep mock API failure logs on the same DuckDB ingestion path. Serialize or queue writes through the app's single DuckDB owner as needed by the chosen Node client; avoid per-request database instances.

Alternative: write the SQLite timestamp first. Rejected because a run could appear to have telemetry that was never stored. Alternative: promise atomic commits across both files. Rejected because there is no shared transaction coordinator.

### Bound and batch the in-process ingestor

Keep OTLP authentication and validation in the existing Nitro routes. Enforce separate configurable compressed-request and decompressed-body byte limits while reading and inflating, before an oversized payload can be fully buffered. Return HTTP 413 on either limit. Validate finite positive defaults at startup; initial values can be tuned using the benchmark rather than treated as product guarantees.

Normalize accepted records into bounded batches and send them through one in-process DuckDB writer with a cap on pending records and bytes. Coalesce small concurrent requests only while each request still awaits its own durable result. Use bulk writes rather than one SQL statement per row; for idempotency, stage a batch and merge/upsert by span or log identity in a transaction. A DuckDB Appender is an option only if its flush and conflict behavior satisfy that contract. If the writer reaches capacity, reject new requests with a retryable temporary failure instead of accepting work into an unbounded queue. A request succeeds only after the DuckDB transaction and required SQLite run metadata update complete. On shutdown, stop intake and finish or fail pending requests explicitly.

Do not add Bun workers at this stage. The production image currently runs Node, and workers add a runtime change, message transfer, lifecycle handling, and memory overhead. Consider one worker only if the benchmark shows sustained CPU-bound parsing or normalization after batching; keep DuckDB writes owned by a single writer either way.

Alternative: acknowledge when an in-memory queue accepts a batch. Rejected because process exit could lose acknowledged telemetry. Alternative: add workers preemptively. Rejected because the dominant bottleneck and expected volume are unknown.

### Measure before choosing further machinery

Capture a small baseline with reproducible synthetic OTLP trace and log batches before replacing the current writer. Reuse the same payloads after migration and report accepted records per second, p50/p95 response time, peak process RSS, and CPU use. Include compressed and uncompressed payloads, retries, and simultaneous requests. Record write time separately from parse/normalize time so the DuckDB migration and batching gain can be interpreted. Do not promise a numeric improvement without results.

### Expire telemetry, preserve history

Use `TELEMETRY_RETENTION_DAYS`, default `365`, validated as a positive integer. Run cleanup on startup and daily within the single app process. Delete DuckDB spans and logs whose `received_at` is older than the UTC cutoff. A serialized cleanup operation must not overlap an ingestion write. Retain SQLite runs and mock API call history. Use `lastTelemetryAt` and the same retention cutoff to distinguish expired trace detail from a run that never received telemetry; when only part of a trace remains, mark telemetry-dependent timing as incomplete rather than presenting it as complete. Keep current unavailable behavior for genuinely missing spans.

Alternative: delete runs with telemetry. Rejected by the agreed history behavior. Alternative: use span start time or log event time for retention. Rejected because delayed delivery would be removed immediately.

### Replace MySQL-dependent integration tests

Use disposable SQLite and DuckDB files per integration test scope, with migrations applied through the production startup path. Exercise repository constraints, project isolation, cross-store ingestion retry, expiry, and run-flow queries against real engines. Remove the disposable MySQL service from CI after those tests pass. Keep unit test fakes where they test use-case coordination rather than SQL behavior.

Alternative: substitute SQLite for MySQL only in tests. Rejected because production is also moving to SQLite and DuckDB, so integration tests must exercise both actual stores.

## Risks / Trade-offs

- Cross-store metadata update can fail after telemetry commit -> idempotent ingest and retry preserve eventual consistency; tests cover this boundary.
- DuckDB write contention or slow cleanup can delay OTLP responses -> one owned connection or queue, bounded batches, and serialized cleanup.
- Large gzip payloads can expand beyond the request size -> enforce separate compressed and inflated limits during processing and test both rejection paths.
- A saturated writer can return temporary failures -> bound the queue, return retryable errors, and rely on idempotent retries rather than dropping accepted records.
- SQLite type and constraint differences can subtly change validation -> map every table, index, foreign key, timestamp, and JSON column and run focused integration tests.
- An expired partial trace could yield misleading edge timing -> return an explicit incomplete state for telemetry-derived observations.
- Data directory loss removes both stores -> persist the directory as a Docker volume and document backup of both files together.
- Rolling back the application binary cannot read newly written SQLite/DuckDB data with the old MySQL code -> retain the old MySQL volume during rollout if rollback is needed; this change does not backfill either direction.

## Migration Plan

1. Add SQLite and DuckDB schemas, connection lifecycle, and versioned startup initialization; map existing MySQL types and constraints.
2. Move application repositories and transactions to SQLite, preserving routes, project scope, and observable behavior.
3. Capture a reproducible ingestion baseline, then move span/log insertion and queries to DuckDB with bounded input, batched writes, deterministic log identity, span upsert, backpressure, and cross-store run-flow coordination; compare the same workload afterward.
4. Add retention cleanup and explicit expired/incomplete telemetry states to API contracts and UI.
5. Move integration tests and Docker/CI configuration to disposable embedded files. Verify fresh startup and restart persistence, focused tests, `vp check`, production build, and strict OpenSpec validation.
6. Deploy with a new persistent data volume and empty files. Keep the previous MySQL volume until the new installation is accepted; it is a rollback snapshot, not an automatic data migration.
