# Spec Delta

## Purpose

Lets users inspect service traces and logs from mock API runs, follow observed data flow, and locate services that report errors.

## ADDED Requirements

### Requirement: System ingests OpenTelemetry traces and logs

The system SHALL accept trace and log telemetry forwarded by an OpenTelemetry Collector and persist it for retrieval.

#### Scenario: Ingest trace telemetry

- **WHEN** the collector forwards trace data
- **THEN** the system stores the trace data for the identified trace

#### Scenario: Ingest log telemetry

- **WHEN** the collector forwards log data
- **THEN** the system stores the log data for retrieval

### Requirement: System updates graph from run telemetry

The system SHALL gather telemetry for a mock API run by trace ID after the telemetry stream becomes quiet, then return the assembled run flow.

#### Scenario: Assemble completed run flow

- **WHEN** telemetry for a run's trace ID has arrived and the stream becomes quiet
- **THEN** the system returns the observed service flow and associated errors for that run

#### Scenario: Highlight observed service flow

- **WHEN** the frontend receives assembled run flow data
- **THEN** the graph indicates the services and connections observed during that run and identifies the service reporting an error

### Requirement: Users can view and filter logs

The system SHALL show ingested logs in a logs panel and let users filter logs by service and severity and search log text.

#### Scenario: View logs

- **WHEN** a user opens the logs panel
- **THEN** the system displays available log entries with service, severity, timestamp, and message

#### Scenario: Filter logs

- **WHEN** a user selects a service or severity filter or enters search text
- **THEN** the system shows only matching log entries
