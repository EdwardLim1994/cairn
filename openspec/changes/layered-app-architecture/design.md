# Design

## Context

See `proposal.md` for motivation. The current Nuxt page contains graph, settings, mock API execution, and logs state and markup in one file. Nuxt API handlers commonly combine request handling, Drizzle queries, and workflow logic. The project has no shared API schema layer, Pinia, or Zod today.

## Goals / Non-Goals

**Goals:**

- Establish maintainable frontend and backend boundaries while preserving existing UI and REST behavior.
- Make endpoint input and output contracts explicit, shared, and runtime-validated.
- Make endpoint workflows testable without a live MySQL database or outbound microservices.
- Provide a unit test for every production method/function and Vue component, plus integration coverage for every endpoint, user-facing feature flow, and cross-component interaction.
- Maintain a coverage inventory and finish with no untested production methods, components, endpoints, or feature flows.
- Migrate in small, reversible vertical slices.

**Non-Goals:**

- Change database schema, REST paths, payload semantics, or product behavior.
- Replace Nuxt/Nitro, Vue Flow, Drizzle, or the current persistence model.
- Introduce a generic repository framework, dependency injection container, or service locator.
- Add global state for transient state that is private to a single component.

## Decisions

### Shared Zod contracts live in Nuxt's root `shared/` directory

Create endpoint-oriented schemas and inferred types under `shared/api/`. Each contract defines request parameters/body and response data for one REST endpoint. Frontend API helpers validate responses with the response schema; backend controllers validate incoming input and validate the use-case result before returning it. Continue to accept `unknown` at external boundaries and parse it through Zod.

Use the same schemas for types (`z.infer`) and runtime validation instead of maintaining separate frontend interfaces and server validators. Keep domain rules that need database state, such as checking whether an endpoint belongs to a project, in the use case; Zod handles structural and local value validation. Include the OTLP ingestion routes in the contract set, preserving the collector's existing wire format.

Install `zod` and `pinia` with `@pinia/nuxt`. Import shared schemas explicitly from `shared/api`; do not depend on implicit auto-imports for contract names.

**Alternative considered:** TypeScript-only DTOs. Rejected because they disappear at runtime and cannot replace validation at either network boundary.

### Backend uses a controller -> one use case per endpoint -> domain repository flow

Keep Nuxt `server/api` and `server/routes` handlers as controllers. Each handler should perform HTTP-specific work (read path/query/body, validate with the shared schema, invoke its single endpoint use case, validate/serialize the response, and translate known failures to HTTP errors).

Create one use-case function per endpoint under `server/use-cases/`, including distinct operations for GET/POST/PUT/DELETE and telemetry ingestion routes. A use case owns the complete endpoint workflow and calls domain-specific repository functions. Move Drizzle queries and transaction boundaries into repositories under `server/repositories/`, grouped by domain (canvas, services, mock APIs, environment variables, runs/telemetry). Keep repository operations narrow and named for their domain; do not create a generic CRUD base class.

Use cases should receive the repository operations they need as function dependencies, with production controllers passing the real repository functions. Tests can pass focused fakes. Avoid a global dependency container and class-per-use-case boilerplate. Pure validation and transformation helpers that are shared or independently useful can remain in `server/utils/`.

**Alternative considered:** Route handlers importing `getDb()` and repositories directly while retaining workflow logic in handlers. Rejected because it leaves behavior coupled to Nitro and makes isolated tests difficult. A DI container was also considered and rejected as unnecessary indirection for this app.

### Frontend follows MVVM, with Pinia stores owning shared model state

Keep `app/app.vue` as the page composition root. Extract graph canvas and node views, service settings, mock API settings, and logs into focused components. Pinia stores own cross-component state and actions, initially grouped by the existing domain boundaries: graph/services, mock APIs/environment variables, and observability/logs. Avoid duplicating the same entity state across stores; keep panel-open, input-focus, and other component-only state local.

Treat Pinia stores as the shared Model state boundary. Add focused view-model composables only for view-specific derived state and event coordination; they should call stores and API helpers rather than duplicate store state. Views render props/store-derived state and emit user intent through view-model actions. API helpers use the shared Zod request/response schemas and keep fetch details out of components.

**Alternative considered:** Put all state and workflow logic in composables. Rejected for state that must be shared consistently by sibling components and graph/log panels. A single application-wide Pinia store was also rejected because unrelated domains would remain coupled.

### Tests cover each code unit and each integrated feature path

Maintain a test inventory that maps every production method/function and Vue component to its unit/component tests, and every REST or OTLP endpoint, user-facing feature flow, and cross-component interaction to integration tests. This inventory is the completion checklist; code coverage percentages alone do not prove that each required item has a test.

Unit tests cover each method/function in stores, view-model composables, API helpers, use cases, repositories, controllers, and other production modules. Component tests cover each extracted Vue component's rendering and user interactions. Integration tests exercise each API endpoint across controller, use case, and repository against a disposable MySQL instance; outbound microservice and collector dependencies are stubbed or replaced with deterministic local test servers. Frontend integration tests exercise complete feature paths across the participating views, stores, and API client. Tests must assert observable outcomes and important failure paths, not merely execute code.

Each migration slice adds its tests and updates the inventory in the same task group. The final verification requires the full unit and integration suites, a review of the inventory against production exports/components/routes/features, and no missing test mappings. Use the existing Vite+ test tooling where suitable; add only the test utilities needed for component mounting and disposable-database integration.

**Alternative considered:** Rely only on aggregate line/branch coverage thresholds. Rejected because aggregate percentages can pass while a particular method, component, endpoint, or feature flow has no direct test.

### Migrate by vertical slice and preserve outward behavior

Establish the shared contract and test conventions first, then migrate one endpoint and its frontend flow at a time. Start with canvas load/save and graph state, then service management, mock API/environment-variable management and execution, and finally logs, runs, health checks, and OTLP ingestion. Each slice moves its controller/use case/repository and the corresponding model/store/view-model/view boundaries together where practical.

Before replacing a route, record its current request/response behavior in shared schemas and add its unit and integration tests. Add unit tests for every method and component as it is extracted, and update the coverage inventory within that slice. Run relevant unit and integration checks after each slice. Keep route paths, status/error behavior, and persisted data compatible; do not combine this refactor with schema migrations or API redesign.

## Risks / Trade-offs

- **More files and some indirection** -> Keep one use-case function per endpoint as requested, but group repositories by domain and avoid generic abstractions.
- **Shared schemas can drift from legacy behavior during extraction** -> Characterize current payloads first and add contract tests before moving workflow logic.
- **Frontend stores can become oversized or duplicate server state** -> Assign each shared state field one owning store, and leave ephemeral component state local.
- **Repository boundaries may obscure transaction ownership** -> Keep each multi-table transaction within one domain repository operation and have the use case coordinate repository operations only when a workflow truly spans domains.
- **Incremental migration can temporarily leave mixed patterns** -> Track endpoint coverage in tasks and remove old inline query/workflow logic as each slice is completed.
- **Exhaustive test scope can increase refactor time** -> Add coverage alongside each slice and use the inventory to keep gaps visible instead of deferring tests to a final pass.

## Migration Plan

1. Add dependencies, shared schema conventions, API client helpers, and focused test setup; do not change runtime behavior.
2. Extract the graph UI and shared graph state, migrating canvas load/save as the first backend vertical slice.
3. Migrate service CRUD and health-check flows, then mock API and environment variable flows.
4. Migrate mock API execution and run/flow retrieval, preserving trace correlation and failure logging.
5. Migrate logs and OTLP ingestion, then remove obsolete route-local database and workflow code.
6. Reconcile the coverage inventory against all production methods, components, API endpoints, and feature flows; fill any gaps and run the full unit and integration suites, formatting, lint/type checks, production build, and strict OpenSpec validation. Compare all endpoint contracts with the pre-refactor behavior.

Rollback is per slice: restore the previous handler/component wiring while retaining unchanged database tables and API routes. Since database and wire formats remain unchanged, no data rollback is required.
