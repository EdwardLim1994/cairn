# Tasks

## 1. Persist call history

- [x] 1.1 Add the project-scoped history table linked to runs, including API metadata, request snapshot, status, trace ID, and trigger time; generate and verify the Drizzle migration.
- [x] 1.2 Create history records with each triggered run and finalize their status on success and failure; verify focused server tests cover saved request snapshots and both outcomes.
- [x] 1.3 Add project-scoped history list, single-entry delete, and clear-all operations without deleting runs or telemetry; verify API tests cover ordering, scoping, and preserved linked records.

## 2. Browse and inspect history

- [x] 2.1 Add a main-page header control and right-side history panel showing newest-first entries with timestamp, API name, method, URL, and status; verify component tests cover opening and rendered entries.
- [x] 2.2 Add expandable request and response details using the history snapshot and linked run; verify tests confirm request data remains unchanged after editing the active mock API.
- [x] 2.3 Add per-entry removal and clear-all actions; verify tests confirm history rows disappear while linked runs, spans, and logs remain.

## 3. Replay saved traces

- [x] 3.1 Connect history replay to the linked run's saved flow data and graph observation state; verify replay does not call the mock API trigger endpoint.
- [x] 3.2 Add the mostly-hidden panel state and upper-right restore control; verify component tests cover entering replay and restoring the full panel.
- [x] 3.3 Run focused integration checks for history listing, details, deletion, and saved-trace graph replay; verify the feature works with a changed or deleted mock API.
