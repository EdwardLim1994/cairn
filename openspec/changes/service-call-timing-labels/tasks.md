# Tasks

## 1. Capture outbound span timing in run flow

- [x] 1.1 Preserve normalized OTLP span kind in the existing span attributes and add ingestion tests for client, server, and missing span kind values.
- [x] 1.2 Extend run-flow edge assembly to retain each matching outbound client span duration, aggregate by observed source/target service pair, and represent missing telemetry; add tests for single, repeated, parallel, failed, and missing-client-span cases.
- [x] 1.3 Update the shared run-flow response schema and API client types for cumulative timing and per-call breakdown, and verify schema/API client tests cover existing flows without timing data.

## 2. Render and replay timing labels

- [x] 2.1 Carry timing details in graph observation state and clear/apply them with existing run observations; verify graph store and run view-model tests cover new runs and saved trace replay.
- [x] 2.2 Render observed service connections as square step edges with cumulative labels near the source outbound handle, an unavailable label for missing timing, and per-call tooltip details; verify graph view-model and edge component tests cover both data states and label content.
- [x] 2.3 Verify saved-run replay displays that run's timing labels without triggering the mock API again, using focused replay tests.
- [x] 2.4 Render all connection types and the connection preview with square paths by default; verify the shared edge renderer and graph canvas configuration.
- [x] 2.5 Remove the global latest-run panel and show colorized status, trace ID, and total trace duration in the trigger node response panel.
- [x] 2.6 Highlight inbound and outbound handles connected by observed API or message edges and dim unrelated connected handles to gray.
- [x] 2.7 Automatically open the corresponding trigger node response panel after a mock API run finishes.
- [x] 2.8 Center and zoom the graph viewport on the active response panel after a mock API run finishes.

## 3. Integration validation

- [x] 3.1 Run focused telemetry, run-flow, graph, and replay tests, then validate this OpenSpec change with `openspec validate service-call-timing-labels --strict`.
