# Design

## Context

See `proposal.md` and `specs/service-call-timing/spec.md`. Trace ingestion currently persists OTLP span IDs, parent IDs, service names, start/end times, status, and attributes, but drops the OTLP span `kind`. Run-flow assembly derives cross-service edges from parent/child spans and reduces them to service pairs. The graph animates observed downstream connections and can replay a saved run's flow.

## Goals / Non-Goals

**Goals:**

- Derive outbound call durations from caller-side OpenTelemetry client spans.
- Preserve individual call durations while showing one cumulative duration per observed service connection.
- Reuse run-flow completion and replay behavior so live and historical views show consistent measurements.

**Non-Goals:**

- Infer a call duration from a downstream server span when its caller-side client span is missing.
- Persist aggregate metrics or compare durations across multiple runs.
- Add automatic label collision avoidance or layout changes.

## Decisions

### Use caller-side client spans as the measurement

Measure each outbound call from the matching client span's `startTime` to `endTime`. This measures the caller's elapsed wait for the downstream call, including network and downstream response time. Do not use a server span's duration as a substitute because it measures downstream processing and omits caller-side waiting.

OTLP span `kind` is currently discarded during ingestion. Preserve it in the existing JSON attributes as a normalized `span.kind` value, avoiding a database migration. Only spans identified as `CLIENT` contribute outbound call timing. Existing parent/child correlation remains the basis for matching the caller and downstream service connection.

### Preserve call-level timing and aggregate by observed connection

Extend each run-flow observed edge with the individual outbound client span durations that map to its normalized source and target service names. Do not collapse spans before collecting timing values. The graph continues to render the existing observed connection representation and calculates its label as the sum of the individual durations. The sum is cumulative call time; overlapping calls can make it greater than wall-clock elapsed time.

Retain the per-call durations with the edge data and expose them in a compact tooltip when the user hovers over the timing label. This keeps the default graph label readable and makes repeated calls inspectable.

### Render square edges with timing labels

Render all graph connections with a shared Vue Flow edge component built on `getSmoothStepPath` and `BaseEdge`, using a zero border radius to produce square paths. Set the new-connection preview to Vue Flow's step mode as well. Place an observed timing label near the source outbound handle and just above the path, then style it so it remains legible against the canvas. Use an `N/A` label when an observed edge has no usable client-span timing, with an SVG title tooltip explaining that instrumentation telemetry was not found. Include the cumulative duration and each individual call duration in the tooltip. Do not render zero for missing data.

No collision-avoidance algorithm is included. Labels use a consistent default position above each edge; visual tuning can follow after the first implementation is reviewed in the graph.

### Follow completed run and replay lifecycle

The frontend already waits for trace collection to become quiet before applying the assembled flow. Add timing data to that flow and apply it with existing observed edge state. When a saved history entry is replayed, use that run's flow and durations without triggering the mock API again. Clear timing labels when observations are cleared for a new run, following the existing graph observation lifecycle.

### Show total run details beside the trigger node

Keep the latest response panel beside its trigger node as the single response view. Automatically open it after a mock API execution completes and fit the viewport around the rendered response panel itself so the result is enlarged and centered. Measure the panel after rendering so its overlay bounds are included in the focus area. Allow graph zoom up to 3x so large viewports can zoom in enough to inspect the panel. Remove the global latest-run drawer to avoid duplicating the response. Derive total trace duration as the wall-clock span from the earliest start to latest end among spans in the run's trace, then display it with the run status and trace ID. Color the status with success or error theme colors. If the flow has no spans, show the duration as unavailable.

### Highlight observed connection handles

Use the same observed API edges, message connection IDs, and triggered mock API target endpoint that drive edge animation to mark their node handles. Give observed inbound and outbound handles the accent color; keep other connected handles gray so activity is easy to follow. Apply the same handle state to expanded and collapsed service nodes.

## Risks / Trade-offs

- **Some instrumentation omits CLIENT spans or span kind** → Show timing as unavailable instead of inferring request duration from server spans or parent operation spans.
- **Client span attributes vary across instrumentation libraries** → Use the existing trace parent relationship and service identity for edge mapping; cover incomplete or unsupported mappings as unavailable.
- **Concurrent calls produce a sum greater than elapsed time** → Label the value as cumulative call time and preserve each measurement in the tooltip breakdown.
- **Several configured graph edges can connect the same pair of services** → Run-flow currently identifies observed edges by service pair, so apply the same service-pair aggregate to each displayed representation of that observed connection until telemetry can map calls to a specific configured endpoint reliably.
- **Step paths and labels can crowd a dense graph** → Keep the first pass to the agreed square edge and default label position, then tune spacing based on graph review.

## Migration Plan

No database migration is expected. Older stored spans without `span.kind` remain valid and produce unavailable timing labels. New ingestion stores normalized span kind in JSON attributes. The run-flow response gains optional timing details so saved traces collected before this change continue to replay without errors.

Rollback by reverting the UI and run-flow changes. The additional JSON span attribute is backward-compatible and can remain in stored rows.
