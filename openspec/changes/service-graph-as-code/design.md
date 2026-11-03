# Design

## Context

See `proposal.md` for motivation and `specs/service-graph-as-code/spec.md` for user-visible behavior. Service settings currently include endpoint arrays, health-check fields, and backend identifiers. Service and Mock API node positions live on their detail records; canvas responses combine graph details, positions, and mock API data. Endpoint-level call relationships are planned in `endpoint-level-service-calls`.

## Goals / Non-Goals

**Goals:**

- Keep the graph code document limited to service and endpoint configuration plus endpoint-level calls.
- Keep node positions in canvas state, separate from service and Mock API detail records.
- Validate the entire proposed service graph before replacing saved service data.
- Reconcile services and endpoints by stable keys to preserve internal references and positions.

**Non-Goals:**

- Import or export Mock API trigger definitions, request bodies, call history, telemetry, or access tokens.
- Add a downloadable graph export feature.
- Include node positions or database IDs in graph code.

## Decisions

### Use versioned JSON as the graph code format

Define a top-level `version` and a `services` array. Each service has `key`, `name`, `framework`, `baseUrl`, an optional `healthCheck` object with `url` and `headers`, and an `endpoints` array. Each endpoint has `key`, `name`, `apiType`, `method`, `url`, and `outboundConnections`, whose targets use `serviceKey` and `endpointKey`.

Keep `apiType` at `REST`; support the existing framework values (`Spring Boot`, `.NET`, `Other`) and methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`). Do not include database IDs, timestamps, active state, or positions. New services default to active; updates preserve the active state of matching services.

Generate stable keys for services and endpoints created through the UI. Persist imported keys in project scope. A service key is unique within a project; an endpoint key is unique within its service. Renaming a service or endpoint does not change its key. Calls resolve through these keys and persist through the endpoint-level relationship model from `endpoint-level-service-calls`; do not store `outboundConnections` as duplicate JSON data.

### Separate node positions from graph detail

Add `graph_node_positions` with project ID, node type, entity ID, and coordinates. Support service and Mock API trigger node types. Use a unique index across project, node type, and entity ID. The existing service and Mock API IDs remain the position table's entity IDs; stable code keys map to them during Apply.

Remove position columns from service and Mock API detail records and remove obsolete shared Mock API node coordinates from the project row. Keep viewport and node-lock state as project canvas settings. Canvas read/write operations join or update positions separately. Validate node ownership and write positions in the same transaction as service graph changes. Delete position rows when their corresponding nodes are deleted.

Reset the non-production database before applying this schema change. Do not backfill old position columns. The user accepts loss of existing development data; keep Drizzle schema, migration SQL, and journal metadata in sync.

### Keep the editor as a draft until Apply

Add a Graph as code button to the main header. Open a right-side panel with Import above the editor, then Discard and Apply in the footer. Initialize an empty graph with an empty editor. For an existing graph, serialize current service data and endpoint calls to JSON without positions or Mock API data. Import replaces only the editor draft; Discard restores the saved graph draft; Apply performs validation and replacement.

Reuse CodeMirror JSON support and the existing custom completion pattern. Offer field-aware completions for `framework`, `apiType`, and `method`; no new editor dependency is needed. Parse and validate in the browser for useful line and field errors, then validate again on the server. Reject duplicate keys, unsupported enum values, duplicate calls, unknown references, cross-project references, and same-service calls. Do not mutate the canvas or database on any validation failure.

Apply the service graph transactionally by matching stable keys. Update matching service and endpoint rows while preserving their database IDs and position records. Remove services and endpoints omitted from the manifest, then create new rows for new keys. Retain Mock API trigger records outside the manifest; if a removed endpoint was their target, leave the trigger unassigned through the existing nullable target behavior.

### Handle positions based on graph state

On Apply to an empty canvas, run automatic graph layout after importing services and calls, then save the generated positions in `graph_node_positions`. On Apply to a populated canvas, keep positions for matching service keys and existing Mock API trigger nodes. Place new service nodes in available slots without moving existing nodes. Leave full re-layout to the separate Auto arrange action.

Map the optional health-check object into the existing service health-check URL and custom headers. Store imported header rows inline and clear any template reference; graph code does not carry project-specific header-template IDs.

## Risks / Trade-offs

- Generic typed node references cannot use one foreign key for multiple entity tables → Validate project ownership and remove position rows in the same transactions that create or delete nodes.
- Stable keys add identity separate from display names → Generate keys once, persist them, and retain them across edits and renames.
- Resetting the development database loses local graph data → This is accepted before production; keep a single documented migration path and verify it on a clean database.
- Inline health-check headers can contain secrets → Import only; do not add a file export action in this change.

## Migration Plan

Reset the non-production database. Add service and endpoint code-key columns, create `graph_node_positions`, and drop old node-position columns from service, Mock API, and project records. Apply the migration with the normal Drizzle workflow. Roll back by reverting the application and migration; restoring pre-change local data requires a database backup because positions are not backfilled.

## Open Questions

None.
