# Tasks

## 1. Trigger Node Component

- [x] 1.1 Create a compact graph node that displays a mock API name and emits a trigger intent; verify component tests cover the rendered name and emitted API identity.
- [x] 1.2 Disable the Trigger button for deactivated APIs and while a run is already in progress; verify component tests cover both disabled states and that no trigger event is emitted.
- [x] 1.3 Connect the graph node trigger intent to the existing mock API run flow; verify a focused integration test confirms the existing run handler is called with the saved API.

## 2. Graph Projection and Automatic Placement

- [x] 2.1 Generate one graph node for each saved mock API with a valid target endpoint and connect it to that endpoint; verify view-model tests cover valid targets and omit APIs without a valid target.
- [x] 2.2 Derive stable positions for trigger nodes near their target service, grouping multiple APIs without overlap and following service moves; verify view-model tests cover deterministic grouping and updated positions after service movement.
- [x] 2.3 Remove the shared mock API graph node, its target edges, and mock-node-only collapse/selection behavior while retaining the existing canvas contract; verify graph tests show service nodes and service-to-service edges remain and the legacy mock-node coordinate remains accepted.
- [x] 2.4 Preserve animated observed service-to-service edges and participating service error/status indicators for live runs and saved trace replay; verify view-model tests cover animated observed edges and service error state in both flows.

## 3. Main Page Entry and Configuration

- [x] 3.1 Add a Mock APIs action to the main page header that opens the existing configuration panel; verify toolbar and app interaction tests cover the action and panel opening.
- [x] 3.2 Remove graph-node-dependent configuration entry points and keep endpoint selection in the Mock APIs panel; verify panel tests cover selecting and displaying the configured target endpoint.

## 4. Integration Verification

- [x] 4.1 Run focused graph, trigger-node, toolbar, and Mock APIs panel tests and resolve regressions; verify all listed test files pass.
- [x] 4.2 Validate the OpenSpec change in strict mode; verify `openspec validate mock-api-trigger-nodes --strict` succeeds.

## 5. Trigger Node Layout and Presentation

- [x] 5.1 Allow trigger nodes to be dragged and display the complete mock API name with an icon-only accessible trigger button.
- [x] 5.2 Persist per-API trigger node coordinates through canvas reads and saves, with automatic placement for APIs without saved coordinates.
- [x] 5.3 Generate and apply the database migration, then validate the updated OpenSpec artifacts.

## 6. Live Trigger Feedback

- [x] 6.1 Highlight trigger-to-service edges without animation while the API call runs, then animate them after completion or failure.
