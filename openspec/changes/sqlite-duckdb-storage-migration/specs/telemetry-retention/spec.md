# Spec Delta

## Purpose

Defines reliable project-scoped telemetry ingestion, age-based expiry, and the meaning of retained run history after telemetry expires.

## ADDED Requirements

### Requirement: Durable ingestion acknowledgement

Cairn SHALL acknowledge an OTLP request only after its accepted telemetry and required run metadata are durably written.

#### Scenario: Successful write

- **WHEN** Cairn accepts an OTLP batch and completes its telemetry and run metadata writes
- **THEN** it returns a successful ingestion response

#### Scenario: Write failure

- **WHEN** a telemetry or required run metadata write fails
- **THEN** Cairn returns a failure response that permits the client to retry without creating duplicate records

### Requirement: Bounded ingestion memory

Cairn SHALL enforce configurable finite limits on compressed OTLP request bytes, decompressed body bytes, and pending ingestion work.

#### Scenario: Oversized compressed request

- **WHEN** a compressed OTLP request exceeds its configured byte limit
- **THEN** Cairn returns HTTP 413 without accepting the batch

#### Scenario: Decompression exceeds limit

- **WHEN** decompression would exceed the configured body limit
- **THEN** Cairn returns HTTP 413 without accepting the batch

#### Scenario: Writer is saturated

- **WHEN** pending ingestion work reaches its configured capacity
- **THEN** Cairn rejects new work with a retryable response rather than growing its in-memory queue without bound

### Requirement: Idempotent span ingestion

Cairn SHALL store at most one span for each project, trace, and span identifier when the same OTLP data is delivered again.

#### Scenario: Retried span batch

- **WHEN** Cairn receives a span batch that was previously accepted for the same project
- **THEN** the project has one current record per trace and span identifier

### Requirement: Idempotent log ingestion

Cairn SHALL assign a stable identity to each received OTLP log record and avoid creating a duplicate when the same batch is retried.

#### Scenario: Retried log batch

- **WHEN** Cairn receives the same log batch twice for the same project
- **THEN** each log record appears once in the project's log view

### Requirement: Project-isolated telemetry queries

Cairn SHALL restrict stored telemetry and derived run observations to the requested project, including when another project uses the same trace identifier.

#### Scenario: Shared trace identifier

- **WHEN** two projects contain telemetry with the same trace identifier
- **THEN** each project's run flow, timing, and log views include only its own telemetry

### Requirement: Configurable telemetry retention

Cairn SHALL delete spans and logs whose receive time is older than an environment-configured retention age. The default retention age SHALL be one year.

#### Scenario: Expired telemetry cleanup

- **WHEN** scheduled cleanup runs with a configured retention age
- **THEN** records received before the cutoff are removed and newer records remain

#### Scenario: Default retention

- **WHEN** no retention age is configured
- **THEN** Cairn uses a one-year cutoff

### Requirement: Retained history identifies expired telemetry

Cairn SHALL keep run and mock API call history after associated telemetry expires and SHALL distinguish expired telemetry from a run that never received spans or logs.

#### Scenario: Open an expired run

- **WHEN** a user opens a saved run after its telemetry has expired
- **THEN** Cairn shows its retained request and response history and identifies telemetry-dependent flow and timing as expired

#### Scenario: Run without observed telemetry

- **WHEN** a user opens a run whose telemetry has not expired but no spans were received
- **THEN** Cairn shows telemetry as unavailable without claiming that it expired
