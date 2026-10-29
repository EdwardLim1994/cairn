# Proposal

## Why

Users need one place to define service relationships, trigger representative API calls, and see which service failed. A graph editor paired with correlated telemetry makes service behavior and errors visible during a mock run.

## What Changes

- Add an interactive service graph with registered service nodes, manually entered service and endpoint URLs, and one shared Mock APIs node whose entries connect to selected service endpoints.
- Let users save the graph and service endpoint details.
- Let users manage mock API entries with a name, selected service endpoint, saved path parameter values, and JSON request template; trigger entries individually and view actual responses.
- Let users manage one project-wide set of string environment variables and reuse them in mock API path parameters and JSON request templates.
- Provide a structured JSON editor with formatting, validation, indentation, and environment-variable autocomplete; keep language modes extensible for future GraphQL syntax.
- Ingest OpenTelemetry traces and logs, associate telemetry with a trigger run, show observed service flow and failures on the graph, and display searchable, filterable logs.
- Provide backend operations for mock API CRUD, canvas saving, triggering calls, assembling run updates, and retrieving logs.
- Provide a Docker image for the production app and a Docker Compose stack for the app and MySQL, configured through runtime environment variables and an `.env.example` template.

## Capabilities

### New Capabilities

- `service-graph`: Create and edit service nodes, endpoint registrations, the shared Mock APIs node, graph connections, and saved canvas state.
- `mock-api-execution`: Manage mock API entries within the shared graph node, configure route parameters and reusable environment variables, trigger calls against selected service endpoints, and inspect actual responses and run outcomes.
- `telemetry-observability`: Ingest trace and log telemetry, correlate it to runs, and present observed service flow, errors, and logs.
- `container-deployment`: Build and run the app and MySQL with Docker, and configure app runtime settings through environment variables.

### Modified Capabilities

None.

## Impact

- Frontend: Nuxt single-page app; Vue Flow graph editor based on the supplied design reference.
- Backend: Nuxt server endpoints for graph persistence, mock API CRUD and triggering, run updates, telemetry ingestion, and log retrieval.
- Data: MySQL with Drizzle ORM for graph, endpoint, mock API, environment variable, run, trace, and log records as needed by the defined behavior.
- Editor: Vue CodeMirror integration with JSON language support, template-aware validation, and autocomplete.
- Integration: OpenTelemetry Collector receives service telemetry and forwards traces and logs to their respective ingestors.
- Deployment: Dockerfile, Docker Compose, and `.env.example` provide the production image, MySQL persistence, and runtime configuration.
- External service frameworks and instrumentation remain user-provided; framework selection is descriptive metadata.
