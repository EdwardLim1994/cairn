# Design

## Context

See proposal.md for motivation and specs for user-visible behavior. The current page uses separate right-side panels for service, message queue, Mock API, Graph as code, and access-token settings. Logs use a distinct bottom panel. The graph groups `message_destinations` by `queueId`, with broker fields already stored on each destination and node positions currently saved against the grouped queue ID. Service health is polled by a client timer every 10 seconds. Graph as code uses JSON text and a validated manifest object.

Use `C:\Users\User\Downloads\Cairn\Main.dc.html` as the updated visual reference, not as production code. It is a static prototype with sample values and some controls that do not map to current Cairn behavior.

## Goals / Non-Goals

**Goals:**

- Present the primary configuration areas through one right-side drawer while keeping Logs in the bottom drawer.
- Make node creation and editing explicit without removing graph context-menu creation.
- Represent each Kafka topic or RabbitMQ topic exchange as a separate message queue node with independent connection settings.
- Make health freshness understandable with one fixed polling cadence.
- Use YAML at the Graph as code text boundary while preserving the current validated manifest and API object model.

**Non-Goals:**

- Add workspace or environment management.
- Add operator login token management.
- Add a shared broker-connection entity or a central settings page that manages multiple topics.
- Provision or mutate broker topology, or display nonessential partition, retention, or durability metadata.
- Change telemetry correlation, mock API execution, or replace Vue Flow and CodeMirror-based domain editors.

## Decisions

### Use one right-side drawer for primary panels

Create one drawer shell with view state for Manage Nodes, Mock APIs, Run History, Graph as code, Access Tokens, and service/message queue settings. Selecting a service or message queue from the manager changes the drawer content to its settings page; Back returns to the node list. Direct Edit actions open the same shell focused on the selected item. Mock API Edit opens its configuration directly. Keep Logs as an independent bottom drawer as shown in the reference.

Alternative considered: retain separate right-side slideovers for each settings panel. That duplicates overlay and focus behavior and can stack drawers when entering settings from Manage Nodes.

### Treat each message destination as its own message queue entry and graph node

Each Kafka topic or RabbitMQ topic exchange is created, listed, edited, and positioned independently. Its settings include its broker kind, connection settings, destination name, and its publisher/subscriber links. Add queue creates one topic or exchange; it does not create an empty broker group. Creating another destination uses Add queue again. Do not add a shared broker configuration entity or aggregation UI. Keep the product wording Message queues / Add queue; identify Kafka topics and RabbitMQ exchanges in the destination detail.

Reuse each existing `message_destinations` row as the independently editable destination. Build graph nodes and message handles keyed by destination ID instead of grouping them by `queueId`. Persist canvas positions per destination. For existing projects that have multiple destinations grouped under one queue position, preserve the prior group position for the first destination and place the remaining destinations with the existing graph layout routine before persisting their independent positions. Keep each destination's existing broker settings and all `message_connections` unchanged. Retain legacy queue fields as needed for backward-compatible API and Graph as code handling, but do not use them to group the new UI.

Alternative considered: retain one graph node per broker group with multiple topic rows or expose a parent broker settings page. The user chose independent per-topic entries, so repeated connection values for topics on one broker are intentional.

### Make creation transactional from the user's perspective

New service, destination, and mock API views hold a local form until the user chooses Create or Discard. Do not persist a draft or add a partially configured object to the graph. Require the fields needed to create a valid object, such as a destination name and broker connection for Add queue. Keep Save/Discard behavior for editing existing records.

Keep Register service and Add queue in Manage Nodes and retain the existing graph context-menu actions. This gives users a centralized list and preserves quick canvas creation.

### Use explicit Edit actions and preserve non-edit graph gestures

Graph node body clicks do not open settings. Add an Edit action on service, message queue, and mock API trigger nodes. Service and destination Edit open their settings directly in the shared drawer; trigger Edit opens Mock APIs on that API. Keep drag, edge creation, collapse, response-panel, and WebSocket controls independent from Edit.

### Display project identity without workspace or environment semantics

Use `PROJECT_ID` for the header chip and do not show an environment or workspace name. If no project ID is available, omit the chip. Preserve the existing service framework behavior and use the product's `Other` label; render the two-character service-name mark for that framework as previously specified.

### Poll service health every 60 seconds while the graph page is open

Use one page-bound client timer with a 60-second interval for all services; clear it when the page unmounts. Do not persist or configure per-service intervals. Keep the most recent check completion timestamp in session memory and display a fixed “Checks every 1 minute” label plus elapsed time only in service settings. Graph service nodes continue to show health state without last-check age. Show a not-yet-checked state before a check completes.

Alternative considered: background server polling or per-service cadence. The user selected a one-minute polling period while Cairn is open, and the current polling lifecycle already follows the page lifecycle.

### Parse and emit YAML at the Graph as code boundary

Use a YAML parser/stringifier and YAML editor syntax support. Parse text to an object, validate it with the existing Zod manifest schema, and send the existing JSON-shaped API payload. Emit YAML for the editor and downloads while continuing to accept valid JSON input. Do not change database storage or backend contracts to YAML.

### Adapt the reference without copying prototype-only behaviors

Use its toolbar hierarchy, compact node cards, Edit controls, theme colors, drawer page transitions, status layout, and responsive treatment. Preserve Cairn's response panels, trace and timing labels, logs, history, WebSocket controls, token lifecycle, and graph operations. The access-token view covers OTLP ingestion tokens only; omit the operator login section. Ignore the prototype's Kafka partition/retention and RabbitMQ durability fields because Cairn will not manage broker topology.

### Group repeated outbound rows by destination

Keep endpoint-level service-call configuration and persistence unchanged, but group the service node's visible outbound rows by target service. Group message publishers by destination. Keep the individual edge handles in each row so configured connections and source endpoint identity remain available. Since observed timing is aggregated by source and target service pair, show its label only once across the configured edges for that pair while continuing to animate and highlight every observed endpoint connection.

## Risks / Trade-offs

- [Existing destinations may share a saved queue position] → Convert grouped positions to per-destination positions and verify that all existing topics and connections remain visible after reload.
- [Repeated broker settings can drift when users configure several topics on one broker] → Keep each destination self-contained as requested and support existing project-scoped variable references for secret values.
- [One drawer hosts several panels with different forms] → Keep each current form's validation, save/discard, close, and focus behavior while sharing only the shell and navigation.
- [One-minute polling makes status less fresh than the current 10-second cadence] → Display last-check age in service settings so users can judge freshness.
- [Changing node clicks can interfere with graph interaction] → Test body selection, dragging, edge handles, and Edit actions separately.
- [YAML parsing errors differ from schema validation errors] → Report them separately and leave the graph unchanged on either failure.

## Migration Plan

1. Update graph view-model and canvas persistence to create one graph node and position per destination while preserving destination rows and message connections.
2. Convert existing queue-group positions into per-destination positions, preserving the group's current location for one destination and placing sibling destinations through the existing layout routine.
3. Replace queue-group settings with single-destination create/edit forms. Keep Add queue as one topic/exchange creation and require Create or Discard.
4. Build the shared right-side drawer and navigation, add direct Edit actions, and retain context-menu creation and the bottom Logs drawer.
5. Replace the fixed 10-second health timer with the fixed 60-second page-bound timer and session-local last-check timestamps.
6. Convert Graph as code text parsing and serialization to YAML with JSON-input compatibility.
7. Apply the visual reference and verify existing response, trace, log, token, and WebSocket flows in both themes and responsive layouts.

Rollback restores the previous grouped graph renderer and settings panel while keeping destination records and connections. Per-destination saved positions can continue to be read by the prior renderer as fallback positions; no destructive broker metadata migration is planned.
