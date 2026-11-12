# Proposal

## Why

Frontend workflows span a large page, components, stores, and composables grouped by file type. Developers must trace several long files to change one feature, while closed panels load with the workspace.

## What Changes

- Organize frontend with Feature-Sliced Design layers, cohesive slices, and explicit public APIs.
- Keep toolbar, graph canvas, and every graph node type available at initial load; load other panel UI on demand.
- Keep one full initial canvas dataset, one owner for shared entity state, and derived graph/card views. Reload canonical canvas data after successful mutations.
- Standardize single-item Create, Update, Delete, Discard, and Close flows across manage-node and mock-API cards. Remove batch create/update behavior. **BREAKING:** panel-level batch Save is removed.
- Warn before losing changed form data; confirm deletion; return to card list and show an automatically closing success toast after a successful mutation and refresh.
- Move tests into each module's `_test_` directory, mirroring production paths.

## Capabilities

### New Capabilities

- `entity-editor-workflow`: Predictable card navigation, single-item editing, discard protection, deletion confirmation, and success feedback.
- `workspace-loading`: Initial graph availability and on-demand loading of closed workspace panels.

### Modified Capabilities

None.

## Impact

- Frontend page composition, feature/entity/widget/shared folders, Pinia stores, composables, panels, graph views, API client wiring, and tests.
- No backend route or database migration. Preserve graph layout, observed telemetry behavior, and existing service/mock API semantics.
