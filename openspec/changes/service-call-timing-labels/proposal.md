# Proposal

## Why

The service graph shows which downstream calls occurred, but not how long those calls took. Showing measured outbound call time on each observed connection will help users find slow dependencies and compare calls in a trace.

## What Changes

- Show a duration label above each observed downstream service connection after the run's trace collection completes.
- Use square connection paths for service-to-service graph edges.
- Aggregate durations for multiple outbound calls on the same connection into one edge label, and retain the individual call durations in the run flow for breakdown details.
- Show timing labels when replaying a saved run.
- Indicate when timing data is unavailable because the required instrumentation telemetry is missing.
- Keep total mock API run duration in the trigger node response panel as a separate future task.

## Capabilities

### New Capabilities

- `service-call-timing`: Display outbound service-call durations from correlated OpenTelemetry telemetry on observed graph connections.

### Modified Capabilities

None. The repository has no durable OpenSpec capabilities yet; related trace and graph behavior is documented in completed change-local specs.

## Impact

- OTLP trace ingestion and run-flow response data, including recognition of outbound client spans.
- Graph view-model state and Vue Flow service-to-service edge rendering and labels.
- Run-flow and graph component tests, including saved trace replay.
