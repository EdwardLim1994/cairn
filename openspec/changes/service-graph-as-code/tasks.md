# Tasks

## 1. Separate graph positions from entity data

- [x] 1.1 Add persistent service and endpoint code keys, generating keys for UI-created records and validating uniqueness; verify keys remain stable across edits and duplicate keys are rejected.
- [x] 1.2 Add `graph_node_positions` and remove position fields from service, Mock API, and project records; verify the migration applies to a clean non-production database as agreed.
- [x] 1.3 Update canvas reads and saves to handle position records separately from graph entities; verify service and Mock API node positions round-trip without position fields in service detail responses.

## 2. Validate and apply graph code

- [x] 2.1 Define the versioned JSON manifest schema for services, health checks, endpoints, and endpoint-level outbound calls; verify valid input parses and invalid enums, duplicate keys, duplicate calls, and missing references fail with field paths.
- [x] 2.2 Apply validated manifests transactionally by stable keys using the endpoint-level service-call model; verify matching database identities persist, omitted services are removed, and Mock API triggers remain separate.
- [x] 2.3 Preserve positions for matching service keys and place new services in free slots on populated canvases; verify neither existing service nor Mock API positions move.
- [x] 2.4 Arrange imported services on blank canvases and save generated positions separately; verify layout follows endpoint-level call direction and reload restores positions.

## 3. Build the Graph as code panel

- [x] 3.1 Add the header button and right-side panel with Import, JSON editor, Discard, and Apply; verify imported files change only the editor draft until Apply.
- [x] 3.2 Populate the editor from the current service graph when it is non-empty and initialize it empty otherwise; verify serialized code omits database IDs, timestamps, positions, and Mock API definitions.
- [x] 3.3 Add CodeMirror validation feedback and field-aware completion for framework, API type, and method; verify syntax and schema errors block Apply without changing the graph.

## 4. Verify graph import behavior

- [x] 4.1 Verify Apply replaces service graph content atomically and preserves unrelated Mock API trigger records; removed endpoint targets become unassigned.
- [x] 4.2 Verify a blank-canvas import lays out the graph, while Apply on a populated canvas preserves matching positions and places only new services.
