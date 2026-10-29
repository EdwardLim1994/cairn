# Tasks

## 1. App and data foundation

- [x] 1.1 Add Vue Flow, Drizzle ORM, the MySQL driver, and migration tooling; verify the Nuxt app starts with the new packages installed.
- [x] 1.2 Configure runtime settings for `DATABASE_URL`, `OTEL_COLLECTOR_URL`, `PROJECT_ID`, `PORT`, Collector ingestion token, outbound request timeout, and telemetry quiet/max-wait intervals; add `.env.example` and verify local startup reads the values without committing `.env`.
- [x] 1.3 Define Drizzle tables and migrations for the project-scoped canvas, services, endpoints, mock API entries, service edges, runs, spans, and logs; verify migrations apply to MySQL and project/trace/service/time query fields are indexed.
- [x] 1.4 Add a production Dockerfile and `docker-compose.yml` for app and MySQL, plus `.dockerignore`; declare runtime environment keys without baking deployment values into the image, persist MySQL data, and verify `docker compose config` and app startup on the configured port.

## 2. Server APIs and telemetry

- [x] 2.1 Implement service, endpoint, and canvas APIs with input validation and transactional saves; verify service edits, endpoint edits, graph connections, and node positions persist after reload.
- [x] 2.2 Implement mock API entry create, edit, remove, and list APIs; verify each entry keeps its selected endpoint and removing an entry removes its connection.
- [x] 2.3 Implement the REST trigger route using the selected endpoint's method and URL with the mock API entry's JSON request; create a run ID, propagate `traceparent`, retain actual response details, and record connection, timeout, and non-success status outcomes. Verify against a local REST service.
- [x] 2.4 Implement authenticated OTLP/HTTP JSON ingestion routes for traces and logs; verify Collector exports appear in MySQL with trace IDs and filterable log fields.
- [x] 2.5 Implement run status and flow routes that assemble spans by trace ID after telemetry is quiet and return available data at the maximum wait; verify pending, complete, failed, and incomplete-flow states.
- [x] 2.6 Implement the logs query API with optional service, severity, and text filters; verify each filter narrows returned entries.

## 3. Graph editor and panels

- [x] 3.1 Build the Vue Flow canvas with service nodes, endpoint handles, the shared Mock APIs node, per-row connections, background, minimap, zoom, fit-view, and automatic position saving; verify the updated design layout and graph interactions.
- [x] 3.2 Build service add/edit forms with name, framework, base URL, endpoint name, REST API type, method, and URL; show only endpoint names and methods on service nodes.
- [x] 3.3 Build Mock API settings with editable rows, selected endpoint, JSON request, description, and add/remove/save/discard actions; verify each row's edge targets its selected endpoint.
- [x] 3.4 Add per-row run controls, response display, and running/completed/failed states; verify the active row and endpoint connection highlight during a run.
- [x] 3.5 Build the logs panel with search, severity and service filters, and timestamp/service/message rows; verify observed trace edges and the error service appear on the graph after a run.

## 4. Integration and operation

- [x] 4.1 Connect the UI to the Nuxt APIs and restore saved canvas state on load; verify edits, run responses, flow updates, and logs stay consistent after reload.
- [x] 4.2 Document environment settings, Compose startup, and an OpenTelemetry Collector pipeline that exports REST service traces and logs to the app; verify the documented configuration matches the container service names and ingestion routes.
- [x] 4.3 Walk through one successful and one failing REST call with an instrumented service and Collector; verify response capture, trace correlation, graph highlighting, and log filtering.

## 5. Mock API path parameters and shared variables

- [x] 5.1 Add a Drizzle migration for saved mock API path parameters and project-scoped string environment variables; preserve existing request JSON values and convert prior environment values to text.
- [x] 5.2 Update mock API and environment variable APIs with validation and CRUD behavior; verify project scoping, string values, and rejection of unknown variables or invalid resolved requests.
- [x] 5.3 Add one shared environment variable section to the UI with create, edit, delete, and string value controls; verify edits persist and are available across mock APIs.
- [x] 5.4 Generate saved path parameter fields from the selected endpoint route template; substitute literal values and shared variable references with URL-encoded path segments when triggering a call.
- [x] 5.5 Preserve concrete path values and unresolved Postman variable references when importing matched collection requests; verify route parameter names map to the right path segments.
- [x] 5.6 Add focused server and importer tests for string substitution, path encoding, undefined variables, and endpoint changes.

## 6. Structured request editor

- [x] 6.1 Integrate Vue CodeMirror 6 with JSON language support in the Mock API settings panel; verify Nuxt client rendering, theme compatibility, editor lifecycle, and accessible keyboard editing.
- [x] 6.2 Add formatting, JSON diagnostics, placeholder highlighting, and autocomplete for shared variable names; verify malformed requests and unresolved variables are clearly reported.

## Future enhancements

- Multiple named environment profiles instead of one shared variable set.
- Chained mock API execution with ordered calls, response value extraction, run-scoped variable propagation, per-step results and trace association, and fail-fast behavior by default. Define the chain editor and continue-on-error controls in a separate plan.
- GraphQL syntax highlighting in the request editor. GraphQL request execution remains out of scope until separately specified.
