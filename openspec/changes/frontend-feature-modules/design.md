# Design

## Context

See `proposal.md`. `app/pages/index.vue` wires most workspace state and actions. Components, composables, models, and stores are grouped by file type. `GET /api/canvas` already returns full base data. Pinia is installed, and `GraphCanvas` already uses an async component. The theme and shared controls from `frontend-theme-foundation` are prerequisites.

## Goals / Non-Goals

**Goals:** Make one feature discoverable within one slice, keep shared data owned once, preserve observed graph behavior, and make closed panels cheap at initial load.

**Non-Goals:** Change database schema, split the initial canvas response, or introduce a runtime strategy registry.

### Place workspace overlays and gate the app by session

Open workspace drawers from the right. Place observed timing beside the outbound endpoint so a downstream node does not cover the label. Keep the graph legend clear of controls and instructions. Render the login route alone while the operator session is unauthenticated; after sign-in, update shared session state before showing the workspace. Hide Sign out when operator authentication is disabled. Show header and authorization templates in separate collapsible sections.

The shared `WorkspaceDrawer` owns the top and bottom viewport gaps and available height for every drawer. Panel-specific content styles may set width and appearance, but the shared height takes precedence so panels cannot extend under the toolbar or past the bottom edge.

## Decisions

### Follow Feature-Sliced Design layers and import direction

Use `app/shared` for generic UI and integration code; `app/entities` for service, message destination, and mock API models and shared Pinia state; `app/features` for edit, run, and observation actions; `app/widgets` for the manage-nodes workspace, graph canvas and node views, mock API panel, and other composed panels; `app/pages` for route composition. Treat a business module as a slice or slice group within these standard layers, not as a new top-level FSD layer. Higher layers import lower layers through explicit `index.ts` public APIs. Files within one slice import siblings directly. Do not add wildcard barrels or cross-import between peer slices.

Alternative: place `manage-nodes/service` and `manage-nodes/message-queue` as full data owners. Rejected because graph views also need those entities and FSD peer boundaries would become tangled.

### Keep the workspace page as cross-module coordinator

`index.vue` wires the bootstrap and cross-widget intents. Graph node controls emit intents such as `edit-service(id)`; the page opens the proper editor. The graph widget owns trigger-node response-panel presentation and placement. Mock API features own execution and run state. Avoid a single replacement composable that merely relocates the full page script.

Alternative: have graph nodes import panel state directly. Rejected because node rendering would depend on drawer behavior.

### Use one canonical entity snapshot and local editor drafts

Populate entity stores from the full initial canvas response. Derive graph nodes and card summaries from that source. Keep form drafts local to an open editor; discard them on confirmed close. After a successful create, update, or delete, reload the canvas and update stores before returning to the card list and showing a success toast. Preserve graph viewport and observed telemetry behavior during refresh. If persistence succeeds but refresh fails, retain the editing context and report the partial failure without a full-success toast.

Alternative: optimistically patch every graph and card projection. Rejected because the server also computes readiness and related state; duplicate reconciliation would add risk.

### Standardize single-item editors

Cards navigate to editors; clicking a card never saves. Create has Save and Discard, update has Update and Discard, and Delete appears only for saved items. Compare normalized draft data with its initial snapshot. For a new form, treat entered data as dirty. Close, Back, and Discard use the same dirty confirmation. Delete uses a separate confirmation. Remove the Mock API panel batch Save and its staged multi-item mutation path. Keep existing service, queue, and mock API validation rules. Use Nuxt UI confirmation and toast primitives, including `UApp` where required, rather than a new message stack.

Alternative: generic editor strategy framework. Rejected because the few known entity forms have distinct validation and persistence while sharing only navigation controls.

### Defer closed-panel UI and panel-only fetches

Keep toolbar, graph canvas, graph node types, and base data on the initial path. Load manage-nodes, mock APIs, history, logs, and other side panels when opened. Do not fetch logs or history at startup solely for closed panels; continue service and queue health work needed by visible graph. Keep one open panel's state separate from another's.

Alternative: split the canvas API into summary and detail calls. Deferred to Cairn Cloud because the current full load is accepted and no measured bottleneck justifies cache complexity.

### Follow module test placement

Move tests for each migrated slice into one `_test_` directory that mirrors production paths within that slice. Test public behavior and cross-widget paths, especially dirty discard, mutation refresh, graph events, and deferred panel loading. Retain focused tests for telemetry-derived graph states.

## Risks / Trade-offs

- FSD moves may break Nuxt auto-imports: use explicit public imports and verify the production build.
- Canvas refresh may reset transient graph state: preserve viewport, selection, and run observations where required by current behavior.
- Dirty comparison can flag formatting-only changes: normalize only fields whose stored representation is known; test unchanged and changed drafts.
- Lazy panels can delay first open: show a loading state and verify focus and keyboard behavior when the component resolves.

## Migration Plan

1. Apply `frontend-theme-foundation` first.
2. Establish FSD directories, import rules, public APIs, and `_test_` placement in one vertical slice.
3. Migrate manage-nodes service and queue editors with card navigation, confirmations, refresh, and toasts.
4. Migrate graph-node and mock-API slices, preserving observed timing, response focus, and WebSocket behavior.
5. Migrate remaining panels and defer their UI and panel-only fetches.
6. Reduce `index.vue` to bootstrap and cross-module event wiring; run focused tests, Vite+ checks, build, and strict OpenSpec validation after each slice.
