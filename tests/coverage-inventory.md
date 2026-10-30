# Refactor test coverage inventory

This inventory tracks current production code that the `layered-app-architecture` change migrates. Mark an item covered only when its named unit/component or integration tests exist and pass. Component tests cover each component; integration tests cover each endpoint, end-user flow, and interaction among views, stores, API client, and backend.

## Frontend components

- [x] `app/app.vue` page composition and cross-view coordination (`useCanvasViewModel.test.ts`, `useGraphInteractionViewModel.test.ts`, `useSettingsPanelViewModel.test.ts`, and feature component tests)
- [x] `app/components/SettingsAccordionCard.vue` render, delete, and toggle events (`SettingsAccordionCard.test.ts`)
- [x] Graph canvas view (`graph/GraphCanvas.test.ts`)
- [x] Service node view (`graph/ServiceGraphNode.test.ts`)
- [x] Mock API node view (`graph/MockApiGraphNode.test.ts`)
- [x] Service settings view (`ServiceSettingsPanel.test.ts`)
- [x] Context menu view (`ContextMenu.test.ts`)
- [x] Mock API and shared environment-variable settings view (`MockApiSettingsPanel.test.ts`)
- [x] Logs panel view (`LogsPanel.test.ts`)
- [x] Application toolbar view (`AppToolbar.test.ts`)
- [x] Toast stack view (`AppToastStack.test.ts`)
- [x] Latest-run drawer view (`LatestRunDrawer.test.ts`)
- [x] Request JSON editor and CodeMirror placeholder behavior (`RequestJsonEditor.test.ts`, `utils/request-editor.test.ts`)
- [x] Graph state and graph view-model interactions (`stores/graph.test.ts`, `composables/useGraphViewModel.test.ts`)
- [x] Service settings and endpoint editor views (`ServiceSettingsPanel.test.ts`)
- [x] Mock API and shared environment-variable settings views (`MockApiSettingsPanel.test.ts`)
- [x] Context menu and toolbar views (`ContextMenu.test.ts`, `AppToolbar.test.ts`)
- [x] Logs panel view (`LogsPanel.test.ts`)
- [x] Toast and latest-run views (`AppToastStack.test.ts`, `LatestRunDrawer.test.ts`)
- [x] Page-level composed feature flows: graph editing/selection/persistence/collapse/highlighting; service edit and graph update; mock API CRUD/import/save; successful and failed runs affecting graph and logs; observability filtering and resizing (`useGraphViewModel.test.ts`, `useServiceViewModel.test.ts`, `useMockApiViewModel.test.ts`, `useMockApiRunViewModel.test.ts`, `useObservabilityViewModel.test.ts`)

## Frontend methods and functions

### Page coordination and extracted functions

- [x] Canvas load, health polling action, save, viewport/node movement, and connection changes (`composables/useCanvasViewModel.test.ts`)
- [x] Canvas context menu, node selection/focus, endpoint and mock API opening (`composables/useGraphInteractionViewModel.test.ts`, `composables/useServiceViewModel.test.ts`, `composables/useMockApiViewModel.test.ts`)
- [x] Service dialog open/add/edit/delete and endpoint actions (`composables/useServiceViewModel.test.ts`, `components/ServiceSettingsPanel.test.ts`)
- [x] Mock panel open, draft CRUD, endpoint selection, JSON formatting, import results/warnings, environment variable actions, and save (`composables/useMockApiViewModel.test.ts`, `components/MockApiSettingsPanel.test.ts`, `utils/postman-import.test.ts`)
- [x] Mock run orchestration and downstream result state (`composables/useMockApiRunViewModel.test.ts`)
- [x] Settings close and outside-click behavior (`composables/useSettingsPanelViewModel.test.ts`)
- [x] Response formatting (`components/LatestRunDrawer.test.ts`)
- [x] Log filter debounce source state, panel opening, resize bounds, and time formatting (`composables/useObservabilityViewModel.test.ts`, `components/LogsPanel.test.ts`)
- [x] Endpoint selector options and collapsed endpoint handles (`composables/useGraphViewModel.test.ts`)
- [x] Request editor completions and placeholder extension lifecycle (`utils/request-editor.test.ts`)

### API client

- [x] `createApiClient`, internal `send`, and every endpoint method (`models/api-client.test.ts`)

### Graph store and view model

- [x] Store: `applyCanvas`, `setNodes`, `setEdges`, `setServiceHealth`, `setViewport`, `setServiceEdges`, `toggleServiceEndpoints`, `setAllNodesCollapsed`, `toggleMockConnections`, `setObservations`, `setSelection`, `syncSavedPositions`, and `allNodesCollapsed` (`stores/graph.test.ts`)
- [x] View model: `endpointTarget`, `mockEndpoint`, `endpointHandle`, `frameworkLabel`, `serviceNode`, `mockNode`, `buildEdges`, `syncNodes`, `canvasPayload`, and `syncSavedPositions` (`composables/useGraphViewModel.test.ts`)
- [x] Service view model: `newServiceDraft`, `beginAddService`, `editService`, `openServiceEndpoint`, `addEndpoint`, `removeEndpoint`, `saveService`, and `deleteService` (`composables/useServiceViewModel.test.ts`)
- [x] Service and context-menu views (component interactions: `ServiceSettingsPanel.test.ts`, `ContextMenu.test.ts`)
- [x] Service form to API and graph update path (`composables/useServiceViewModel.test.ts`)

### Mock API store and view model

- [x] Store: mock API/draft/variable setters, draft add/remove, and variable deletion (`stores/mockApis.test.ts`)
- [x] Store: running mock API and run result state (`stores/mockApis.test.ts`)
- [x] View model: path parameter reconciliation, request formatting, draft add/remove, Postman import, environment-variable edit/update/delete/create, and combined save (`composables/useMockApiViewModel.test.ts`)
- [x] Run view model: successful and failed executions, downstream node/edge highlights, and error-service log filtering (`composables/useMockApiRunViewModel.test.ts`)
- [x] Mock API panel interactions for APIs, variables, import control, and save/discard (`components/MockApiSettingsPanel.test.ts`)

### Observability store and view model

- [x] Store: log entries, panel state/height, filters, and filter toggles (`stores/observability.test.ts`)
- [x] View model: log loading, filters, search, panel open behavior, timestamp formatting, and resize bounds (`composables/useObservabilityViewModel.test.ts`)
- [x] Logs panel interactions for multi-select service/severity filters, refresh, close, search, and resize keys (`components/LogsPanel.test.ts`)
- [x] Failed mock run updates service filter and exposes downstream error highlights to the log flow (`composables/useMockApiRunViewModel.test.ts`)
- [x] `listServices`, `createService`, `updateService`, `deleteService`, `checkServiceHealth` (`models/api-client.test.ts`)
- [x] `listMockApis`, `createMockApi`, `updateMockApi`, `deleteMockApi`, `runMockApi` (`models/api-client.test.ts`)
- [x] `listEnvironmentVariables`, `createEnvironmentVariable`, `updateEnvironmentVariable`, `deleteEnvironmentVariable` (`models/api-client.test.ts`)
- [x] `listLogs`, `getRunFlow` (`models/api-client.test.ts`)

### Postman import utility

- [x] `pathSegments`, `normalizedQuery`, `isRouteParameter`, `isPostmanPathVariable`, `matchesEndpointUrl`, `routeParameters`, `rawRequestUrl`, `parsePostmanCollection` (`utils/postman-import.test.ts`)

### Server utilities

- [x] `ensureProject`, `getDb` (MySQL controller and repository integration tests)
- [x] `closeDb` test connection cleanup (`server/api/canvas.integration.test.ts`)
- [x] `required`, `positiveInteger`, `getAppConfig` (`utils/config.test.ts`)
- [x] `getOutboundUrl`, `resolveEndpointPath` (`utils/outbound-url.test.ts`, `utils/environment-variables.test.ts`)
- [x] `environmentVariableInput`, `resolveJsonVariables`, `getVariable` (`utils/environment-variables.test.ts`)
- [x] `record`, `requiredText`, `httpUrl`, `endpointPath`, `endpoint`, `serviceInput`, `finiteNumber` (`utils/graph-validation.test.ts`)
- [x] `pathParameterNames`, `mockApiPathParameters`, `validateEndpointPathParameters`, `mockApiInput` (`utils/mock-api-validation.test.ts`, `utils/environment-variables.test.ts`)
- [x] `readOtlpBody`, `otlpArray`, `otlpObject`, `otlpAttributes`, `otlpTimestamp`, `resourceAttributes`, `normalizeSeverity`, `validHex` (`utils/otlp.test.ts`)

### Backend architecture foundation

- [x] Canvas repository operations and injected endpoint-specific use cases (`server/repositories/canvas/index.ts`, `server/use-cases/canvas/*.test.ts`)
- [x] Canvas reads and transactional writes; canvas GET/PUT controllers and use cases with MySQL (`server/api/canvas.integration.test.ts`, `server/repositories/canvas/canvas.integration.test.ts`)
- [x] Service endpoint use cases and MySQL-backed controller flows (`server/use-cases/services/services.test.ts`, `server/api/services.integration.test.ts`)
- [x] Mock API endpoint use cases and MySQL-backed CRUD/ownership controller flows (`server/use-cases/mock-apis/mock-apis.test.ts`, `server/api/mock-apis.integration.test.ts`)
- [x] Environment-variable endpoint use cases and MySQL-backed CRUD/validation controller flows (`server/use-cases/environment-variables/environment-variables.test.ts`, `server/api/environment-variables.integration.test.ts`)
- [x] Mock API execution use case and MySQL-backed success, HTTP failure, timeout, and failure-log controller flows (`server/use-cases/mock-apis/run-mock-api.test.ts`, `server/api/mock-api-run.integration.test.ts`)
- [x] Run detail and trace-flow use cases, with MySQL-backed endpoint tests for dates, service aliases, downstream edges, errors, pending state, and not-found responses (`server/use-cases/runs/runs.test.ts`, `server/api/runs.integration.test.ts`)
- [x] Log query and OTLP log/trace ingestion use cases, with MySQL-backed query, normalization, filtering, duplicate-span, and run-correlation tests (`server/use-cases/telemetry/telemetry.test.ts`, `server/routes/v1/telemetry.integration.test.ts`)

## Backend endpoint integration coverage

Each route is covered through its controller, endpoint-specific use case, and domain repository using the disposable MySQL service in `docker-compose.test.yml`. Outbound HTTP targets are deterministic test servers/stubs.

- [x] `GET /api/canvas`
- [x] `PUT /api/canvas`
- [x] `GET /api/services`
- [x] `POST /api/services`
- [x] `PUT /api/services/:id`
- [x] `DELETE /api/services/:id`
- [x] `GET /api/services/health`
- [x] `GET /api/mock-apis`
- [x] `POST /api/mock-apis`
- [x] `PUT /api/mock-apis/:id`
- [x] `DELETE /api/mock-apis/:id`
- [x] `POST /api/mock-apis/:id/runs`
- [x] `GET /api/runs/:id`
- [x] `GET /api/runs/:id/flow`
- [x] `GET /api/environment-variables`
- [x] `POST /api/environment-variables`
- [x] `PUT /api/environment-variables/:id`
- [x] `DELETE /api/environment-variables/:id`
- [x] `GET /api/logs`
- [x] `POST /v1/logs`
- [x] `POST /v1/traces`

## User-facing feature integration coverage

- [x] Load graph and service health, edit positions, connect endpoints, and persist canvas (`useCanvasViewModel.test.ts`)
- [x] Create, edit, and delete service nodes and endpoints (`useServiceViewModel.test.ts`, `ServiceSettingsPanel.test.ts`)
- [x] Create, edit, delete, import, and run mock APIs (`useMockApiViewModel.test.ts`, `useMockApiRunViewModel.test.ts`, `MockApiSettingsPanel.test.ts`)
- [x] Create, edit, and delete shared environment variables and resolve them in requests (`useMockApiViewModel.test.ts`, `server/utils/environment-variables.test.ts`)
- [x] Follow mock API success/failure through downstream graph highlighting and correlated logs (`useMockApiRunViewModel.test.ts`, `server/api/mock-api-run.integration.test.ts`, `server/api/runs.integration.test.ts`)
- [x] Filter logs by service, severity, and search; resize and reopen the panel (`useObservabilityViewModel.test.ts`, `LogsPanel.test.ts`)
- [x] Theme toggle interaction (`AppToolbar.test.ts`); cookie persistence is delegated to Nuxt `useCookie` in `app/app.vue`.
