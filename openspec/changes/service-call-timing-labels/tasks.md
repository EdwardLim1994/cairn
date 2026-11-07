# Tasks

## 1. Capture outbound span timing in run flow

- [ ] 1.1 Preserve normalized OTLP span kind in the existing span attributes and add ingestion tests for client, server, and missing span kind values.
- [ ] 1.2 Extend run-flow edge assembly to retain each matching outbound client span duration, aggregate by observed source/target service pair, and represent missing telemetry; add tests for single, repeated, parallel, failed, and missing-client-span cases.
- [ ] 1.3 Update the shared run-flow response schema and API client types for cumulative timing and per-call breakdown, and verify schema/API client tests cover existing flows without timing data.

## 2. Render and replay timing labels

- [ ] 2.1 Carry timing details in graph observation state and clear/apply them with existing run observations; verify graph store and run view-model tests cover new runs and saved trace replay.
- [ ] 2.2 Render observed service connections as square step edges with cumulative labels above the connection, an unavailable label for missing timing, and per-call tooltip details; verify graph view-model and edge component tests cover both data states and label content.
- [ ] 2.3 Verify saved-run replay displays that run's timing labels without triggering the mock API again, using focused replay tests.

## 3. Integration validation

- [ ] 3.1 Run focused telemetry, run-flow, graph, and replay tests, then validate this OpenSpec change with `openspec validate service-call-timing-labels --strict`.
