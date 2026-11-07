# Spec Delta

## Purpose

Lets users identify slow downstream dependencies by displaying outbound service-call durations from correlated OpenTelemetry traces on the service graph.

## ADDED Requirements

### Requirement: Observed service connections show outbound call duration

The system SHALL show a duration label above each observed downstream service connection after trace collection for the run is complete. The duration SHALL represent outbound client-span elapsed time, including the caller's wait for the downstream response.

#### Scenario: Show one observed outbound call duration

- **WHEN** a completed run contains a correlated outbound client span for a downstream service connection
- **THEN** the graph shows that call's elapsed duration above the connection
- **AND** the connection uses a square path

#### Scenario: Do not substitute downstream processing duration

- **WHEN** a trace contains a downstream server span but no matching outbound client span
- **THEN** the system does not use the server span's duration as the outbound call duration
- **AND** the connection indicates that timing telemetry is unavailable

### Requirement: Multiple calls on one connection show cumulative time and a breakdown

The system SHALL show the cumulative elapsed durations for all matching outbound client spans on a connection as its graph label and retain each duration for a per-call breakdown.

#### Scenario: Aggregate repeated calls

- **WHEN** a completed run contains multiple outbound calls over the same service connection
- **THEN** the graph label shows their cumulative duration
- **AND** the call breakdown shows each individual duration

#### Scenario: Aggregate parallel calls

- **WHEN** multiple outbound calls on the same connection overlap in time
- **THEN** the graph label shows the sum of their individual durations
- **AND** the system treats that value as cumulative call time rather than wall-clock elapsed time

### Requirement: Failed outbound calls retain their elapsed duration

The system SHALL show elapsed time for a failed or timed-out outbound client span when its timing telemetry is available.

#### Scenario: Show duration for a failed call

- **WHEN** an outbound call fails or times out and its client span is available
- **THEN** the connection shows its elapsed duration with the existing failure state

### Requirement: Missing timing telemetry is indicated

The system SHALL indicate that timing is unavailable when a correlated outbound client span is missing for an observed downstream service connection.

#### Scenario: Show unavailable timing

- **WHEN** an observed connection has no matching outbound client-span telemetry
- **THEN** the graph indicates that timing data was not found because instrumentation telemetry is missing
- **AND** the system does not display a zero duration

### Requirement: Timing labels follow completed run observations

The system SHALL show connection timing labels only after trace collection for a run completes and SHALL show the same run's timings when its saved trace is replayed.

#### Scenario: Show labels after trace collection

- **WHEN** a run's trace collection is pending
- **THEN** the graph does not present its timing labels as final
- **WHEN** trace collection completes
- **THEN** the graph shows the completed run's timing labels alongside its observed downstream connections

#### Scenario: Replay saved timing data

- **WHEN** a user replays a saved mock API call history entry
- **THEN** the graph shows the timing labels calculated from that saved run's trace
- **AND** the system does not trigger the mock API again
