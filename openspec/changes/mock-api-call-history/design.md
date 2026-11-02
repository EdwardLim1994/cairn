# Design

## Context

See `proposal.md` for motivation and `specs/mock-api-call-history/spec.md` for behavior. The existing `runs` table stores trace IDs, outcome, response data, and timestamps, while spans and logs are correlated by trace ID. Runs currently do not retain the outbound request snapshot. The graph can already load observations for a saved run, and mock API results currently live in client state.

## Goals / Non-Goals

**Goals:**

- Add durable, project-scoped history metadata and preserve the outbound request as it was sent.
- Reuse saved run and telemetry data for detail inspection and graph replay.
- Ensure removing history entries does not remove run or telemetry records.

**Non-Goals:**

- Re-executing an outbound call during replay.
- Backfilling old runs that lack request snapshots.
- Auditing history removal or adding automatic history expiry.

## Decisions

1. **Add a history table linked to the existing run.** Store project ID, run ID, trigger-time API name/method/URL, request snapshot, status, trace ID, and trigger timestamp in a new table. Keep response details in the linked run record, avoiding duplication. Use a foreign key from history to run; history deletion removes only the history row. This preserves existing run and telemetry data and gives the history UI stable identity when the active mock API changes or is deleted. An alternative was expanding `runs` into the history store, but that would mix run detail lifecycle with user-removable history and would not satisfy the separate-table requirement.

2. **Create and finalize history alongside run lifecycle.** At trigger time, create the run and its history entry with the same unique trace ID and the outbound request snapshot. Update history status as the run completes or fails, in the same server-side lifecycle path that finalizes the run. This avoids a history state that diverges from its run. Calls made before this feature ships are not backfilled because their original request may no longer be recoverable.

3. **Expose project-scoped history operations through the server API.** Add a newest-first listing that returns the history snapshot and linked run identifier, plus operations to delete one entry or clear the current project's entries. Load response detail through the existing run relationship. Do not cascade history deletion to runs, spans, or logs. Keep authorization and project scoping consistent with existing run endpoints.

4. **Replay by loading the linked run's saved flow data.** Use the existing run flow endpoint and graph observation state; replay must not invoke the mock API trigger endpoint. The panel's collapsed/replay state is client-side presentation state, with an explicit control to restore it.

5. **Add a reversible schema migration.** Generate the Drizzle schema and migration for the history table and foreign key. No data backfill is required. Rollback drops only the new history table and leaves runs and telemetry intact.

## Risks / Trade-offs

- [History and run status could diverge if finalization paths are missed] → Update history in the same success/error paths as the run and cover both outcomes with server tests.
- [A large amount of retained request data can increase database use] → Store only the request snapshot needed to inspect the call; automatic expiry remains outside this change.
- [Deleting a run could orphan or remove its history relationship] → Define the FK delete behavior explicitly and ensure the stored history snapshot remains useful; current history deletion must never delete the run.
- [Old runs have no request snapshot] → Start recording only after deployment and clearly represent those runs as absent from history rather than synthesizing incomplete entries.

## Migration Plan

1. Add the history table and generated migration; deploy the migration before code that writes history.
2. Deploy server changes that create/finalize history rows and expose list/detail/delete operations. Existing runs remain unchanged and are not backfilled.
3. Deploy the history panel and saved-trace replay UI.
4. To roll back, remove the UI/API writes and then drop the history table. Do not delete run or telemetry records as part of rollback.
