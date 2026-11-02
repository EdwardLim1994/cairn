# Proposal

## Why

Users can inspect only the latest mock API result held in client memory. They need persistent call history to review prior requests and responses and replay their saved traces without sending another request.

## What Changes

- Add persistent history entries linked to run details, with trigger-time API identity, method, URL, status, trace ID, and outbound request snapshots.
- Add a header control that opens a right-side history panel with expandable request and response details.
- Replay a saved trace in the graph without triggering the mock API again; let users restore the full panel after its replay view is partially hidden.
- Let users remove one history entry or clear all history. Preserve linked run details, spans, and logs.

## Capabilities

### New Capabilities

- `mock-api-call-history`: Persistent mock API call history, saved request inspection, trace replay, and explicit history removal.

### Modified Capabilities

## Impact

- MySQL schema and Drizzle migrations for history snapshots linked to existing run details.
- Run and history API routes, shared response schemas, and API client.
- App toolbar, history panel, run view model, graph observations, and component tests.
- No new dependencies. Re-execution and deletion auditing remain future work.
