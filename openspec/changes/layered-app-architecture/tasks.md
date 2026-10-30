# Tasks

## 1. Shared contracts and frontend foundation

- [x] 1.1 Add Zod, Pinia, and `@pinia/nuxt`, configure the Nuxt module, and verify installation and Nuxt type generation with `vp install` and `vp check`.
- [x] 1.2 Inventory the current request and response behavior for every REST and OTLP route, then add endpoint-oriented Zod schemas and inferred types under `shared/api/`; verify schemas with contract tests covering valid and invalid payloads.
- [x] 1.3 Add a typed frontend API client that parses responses with shared schemas and sends schema-conforming inputs; verify client helpers with focused request/response tests.
- [x] 1.4 Create the test inventory and configure the required unit, component, and integration test utilities; verify the inventory lists every current production endpoint, feature flow, component, and method/function to be migrated.

## 2. Frontend graph and service views

- [x] 2.1 Extract the Vue Flow canvas, service node, and mock API node into focused view components while keeping `app/app.vue` as composition root; add a component test for each component and verify graph rendering and interactions.
- [x] 2.2 Add the graph Pinia store and graph view-model composable for graph data, selection, positions, collapse state, and highlighting; unit test every store/composable method and add integration tests for graph editing, selection, persistence, collapse, and run highlighting.
- [x] 2.3 Extract service settings and context-menu views and connect service editing actions to the graph store/API client; component-test each view, unit-test every method, and integration-test service form and graph update behavior.

## 3. Frontend mock API and observability views

- [x] 3.1 Extract mock API settings, shared environment-variable cards, and import controls; add the mock API Pinia store and view-model actions; component-test each view, unit-test every method, and integration-test CRUD, import, and save flows.
- [x] 3.2 Extract mock API run controls and connect run state to graph highlighting and log state through stores; unit-test every method and integration-test successful and failed runs through graph and logs.
- [x] 3.3 Extract the logs panel and add the observability Pinia store/view model for entries, filtering, resizing, and run correlation; component-test the panel, unit-test every method, and integration-test filtering and correlated failure behavior.
- [x] 3.4 Reduce `app/app.vue` to page composition and cross-view coordination; verify each component has a component test and every composed frontend feature has an integration test with `vp check`.

## 4. Backend foundation and canvas endpoints

- [x] 4.1 Establish repository modules grouped by domain and endpoint-specific use-case conventions, with testable repository dependencies and no generic CRUD base; unit-test repository dependency substitution and add every module to the test inventory.
- [x] 4.2 Refactor canvas GET and PUT handlers into thin controllers, one use case per endpoint, and canvas repository operations; unit-test every controller/use-case/repository method and integration-test both endpoints through disposable MySQL, including transaction behavior.

## 5. Backend service and configuration endpoints

- [x] 5.1 Refactor service list, create, update, delete, and health-check endpoints into individual use cases and service repository operations; unit-test every method and integration-test every route, including health-check failures.
- [x] 5.2 Refactor mock API list, create, update, and delete endpoints into individual use cases and mock API repository operations; unit-test every method and integration-test every route, including endpoint ownership validation.
- [x] 5.3 Refactor environment-variable list, create, update, and delete endpoints into individual use cases and repository operations; unit-test every method and integration-test every route, including validation and uniqueness behavior.

## 6. Backend execution and observability endpoints

- [x] 6.1 Refactor mock API execution into its own endpoint use case with run, service, endpoint, variable, and log repository operations; unit-test every method and integration-test outbound success, HTTP failure, timeout, and failure-log behavior with deterministic service stubs.
- [x] 6.2 Refactor run detail and flow endpoints into individual use cases and repositories; unit-test every method and integration-test both endpoints, including trace-correlated flow assembly.
- [x] 6.3 Refactor log query and OTLP log/trace ingestion routes into individual use cases and telemetry repository operations; unit-test every method and integration-test each endpoint's contract, filtering, normalization, and persistence.

## 7. Integration and compatibility

- [x] 7.1 Remove obsolete inline route queries and duplicate frontend state after all slices migrate; verify no legacy paths remain with targeted searches and `vp check`.
- [x] 7.2 Reconcile the test inventory against every production method/function, component, endpoint, and user-facing feature flow; verify every item maps to its required unit/component or integration tests and no coverage gaps remain.
- [x] 7.3 Verify the complete unit, component, and integration suites, production build, and strict OpenSpec validation pass with `vp test`, `vp run build`, and `openspec validate layered-app-architecture --strict`.
- [x] 7.4 Compare every REST and OTLP endpoint against the recorded pre-refactor contracts and run the app through an isolated Docker Compose stack; verify route paths, payloads, persisted data, and user-visible behavior remain compatible.
