# Spec Delta

## Purpose

Lets users identify slow downstream dependencies by displaying outbound service-call durations from correlated OpenTelemetry traces on the service graph.

## ADDED Requirements

### Requirement: Observed service connections show outbound call duration

The system SHALL show a duration label above each observed downstream service connection after trace collection for the run is complete. The duration SHALL represent outbound client-span elapsed time, including the caller's wait for the downstream response.

#### Scenario: Show one observed outbound call duration

- **WHEN** a completed run contains a correlated outbound client span for a downstream service connection
- **THEN** the graph shows that call's elapsed duration near the source outbound handle and above the connection
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

### Requirement: Graph connections use square paths by default

The system SHALL render configured, mock API, message queue, and observed graph connections with square step paths by default. The in-progress connection preview SHALL use the same square path style.

#### Scenario: Render existing and newly drawn connections as square paths

- **WHEN** the graph displays any connection or the user draws a new connection
- **THEN** the connection path uses square corners

### Requirement: Trigger response panel shows total run details

The system SHALL show the latest mock API response beside its trigger node and SHALL NOT show a duplicate global latest-run response panel. The response panel SHALL show the run status, trace ID when available, and total trace duration. Success and failure statuses SHALL use their corresponding theme colors.

#### Scenario: Show completed run details

- **WHEN** a mock API run completes and its trace contains spans
- **THEN** the trigger response panel shows its response status, trace ID, and total duration from the earliest trace span start to the latest trace span end
- **AND** the success or failure status is colorized to match its outcome

#### Scenario: Open response panel after execution

- **WHEN** a mock API run finishes successfully or with an error
- **THEN** its trigger node's response panel opens automatically
- **AND** the graph viewport centers and zooms into the active response panel
- **AND** the previously open trigger response panel closes

#### Scenario: Trace duration is unavailable

- **WHEN** the run flow contains no spans for its trace
- **THEN** the trigger response panel shows that total duration is unavailable

#### Scenario: Keep one response panel

- **WHEN** a mock API run finishes
- **THEN** its response appears beside the trigger node
- **AND** no global response panel appears below the page header

### Requirement: Observed connections highlight their endpoint dots

The system SHALL color inbound and outbound node handles for animated observed connections with the accent color and SHALL render other connected service handles in gray.

#### Scenario: Highlight handles on observed API calls

- **WHEN** a mock API run causes a service connection to animate
- **THEN** the source outbound dot and target inbound dot use the accent color
- **AND** unrelated inbound and outbound dots remain gray

#### Scenario: Highlight handles on observed message connections

- **WHEN** a message connection is observed during a mock API run
- **THEN** its publisher outbound dot and subscriber inbound dot use the accent color
- **AND** unrelated message connection dots remain gray
