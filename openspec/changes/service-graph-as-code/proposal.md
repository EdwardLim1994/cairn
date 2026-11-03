# Proposal

## Why

Users need a repeatable way to create a complete service graph and define endpoint-to-endpoint calls without entering each relationship through the canvas. A validated graph code editor makes service definitions portable for import and keeps layout coordinates separate from service data.

## What Changes

- Add a main-header action that opens a right-side Graph as code panel with Import, a JSON editor, Discard, and Apply. Do not add file export in this change.
- Import service nodes, endpoints, health-check configuration, and endpoint outbound connections using stable service and endpoint keys.
- Validate JSON syntax, field values, key uniqueness, and connection references before applying; leave the current graph unchanged on failure.
- Apply replaces service graph content. On a blank canvas, arrange imported services automatically. On an existing canvas, preserve positions for matching keys and place new services in free slots.
- Keep Mock API trigger nodes outside the import format; configure them after their target services and endpoints exist.
- Store graph node positions separately from service and Mock API details. A database reset is acceptable because the application is not in production.

## Capabilities

### New Capabilities

- `service-graph-as-code`: Author and import service graph definitions, including endpoint-level calls.

### Modified Capabilities

None. The repository has no durable OpenSpec capabilities yet. `endpoint-level-service-calls` is an in-progress change with its own planning artifacts.

## Impact

- Main toolbar, right-side panel, and CodeMirror editor with enum autocomplete.
- Service and endpoint API contracts, stable key storage, graph import validation, and canvas apply behavior.
- Drizzle schema and migrations for a project-scoped graph node position table.
- Existing graph layout and endpoint-level call work, which must use the separated position data.
