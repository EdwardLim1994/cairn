# Design

## Context

See `proposal.md` and `specs/` for motivation and required behavior. The repository is a Nuxt 4 starter with Vue 3; Vue Flow, Drizzle ORM, a MySQL driver, telemetry ingestion, and Docker deployment files are not present yet. `.gitignore` already excludes local `.env` files and allows `.env.example`. The updated HTML is a visual reference: one shared Mock APIs node contains runnable rows, each linked to a service endpoint.

## Goals / Non-Goals

**Goals:**

- Keep graph editing, configuration, run controls, and logs in the Nuxt app.
- Persist graph entities and telemetry in MySQL.
- Run REST calls from the server and correlate resulting telemetry to each run.
- Match the supplied graph layout and panels with Vue Flow custom nodes.
- Run the app and MySQL through Docker Compose with environment-based configuration.

**Non-Goals:**

- Trigger GraphQL, gRPC, or WebSocket endpoints in v1. Register and run REST endpoints only; add other protocols when their request and response handling is designed.
- Add authentication, team workspaces, multiple canvases per project, metrics ingestion, or telemetry retention policies in this change.
- Instrument user services. They must already emit OpenTelemetry traces and logs to the Collector for downstream flow to appear.

## Decisions

### Use Vue Flow for the canvas

Use `@vue-flow/core` with custom service nodes, a custom shared Mock APIs node, and endpoint-level handles. Each mock API row owns its endpoint connection; service-to-service edges terminate at a registered endpoint. Use Vue Flow's viewport, controls, and minimap, then build the surrounding panels and forms to match the reference. Vue Flow provides built-in pan, zoom, node dragging, custom nodes, and edges. A hand-built canvas would duplicate these behaviors.

### Keep app APIs in Nuxt server routes

Use Nuxt/Nitro server routes for canvas and service CRUD, mock API CRUD, call triggering, run-flow reads, log queries, and the two Collector ingestion routes. Keep MySQL credentials and outbound service calls on the server. The browser calls these routes and polls run-flow state while telemetry arrives; no WebSocket layer is needed for v1.

Suggested route groups:

- `GET/PUT /api/canvas` for the saved canvas and graph layout.
- `/api/services` and nested endpoint routes for service configuration.
- `/api/mock-apis` for entries in the shared graph node.
- `POST /api/mock-apis/:id/runs` to trigger a call; `GET /api/runs/:id` for response and status; `GET /api/runs/:id/flow` for assembled trace flow.
- `GET /api/logs` with optional service, severity, and search filters.
- `POST /v1/traces` and `POST /v1/logs` for Collector exports.

### Store graph configuration relationally

Use Drizzle ORM with its MySQL `mysql2` driver. Keep service nodes, endpoints, mock API entries, service-to-endpoint edges, runs, spans, and logs in separate tables with foreign keys. Store canvas viewport and node positions in one canvas record; derive each mock row's graph edge from its selected endpoint. This avoids duplicating endpoint links in both the mock entry and an edge table. Scope all persisted records by `PROJECT_ID`; keep one saved canvas per project because accounts and multiple canvases per project are not in scope.

Index telemetry by project and `trace_id`; also index logs by project, service, and timestamp. Store span/log attributes and response bodies as JSON or text payloads, while keeping fields needed for filtering and correlation in indexed columns. Apply schema changes through Drizzle migrations.

### Trigger REST calls on the server

When a user runs a mock entry, create a run record, then call the selected endpoint using that endpoint's method, base URL plus endpoint URL, and registered JSON request. The mock row's method and URL remain entry metadata, as shown in the design. Return the actual HTTP status, headers, and response body; treat non-success HTTP status as a failed run while retaining its response.

For GET requests, send query parameters in the manually entered URL and do not send a JSON body. Other supported methods send the configured JSON body. Validate URLs as HTTP or HTTPS and reject malformed JSON before saving. Use a request timeout and record timeout or connection failures on the run.

Create a W3C trace ID for each run and pass a valid `traceparent` header to the selected service. Downstream services that honor W3C Trace Context will emit spans with the run's trace ID. Do not infer service flow from configured edges; use collected spans for observed flow and errors.

### Accept Collector telemetry with OTLP/HTTP JSON

Configure the OpenTelemetry Collector to export traces and logs separately to `/v1/traces` and `/v1/logs` using OTLP/HTTP JSON. Decode only the fields needed for trace assembly, log display, and filtering, and persist the records in MySQL. Require a configured ingestion token on these routes so arbitrary clients cannot write telemetry.

After a trigger returns, the frontend polls the run-flow route. The route reports `pending` while new telemetry for the run's trace ID continues to arrive. After a quiet interval, it returns the observed spans and errors; a maximum wait returns available data and marks telemetry incomplete. The frontend overlays observed edges and service errors on the declared graph. The logs panel reads stored log records and applies its filters.

### Package the app and MySQL with Docker

Use a multi-stage Dockerfile: build the Nuxt app, then copy only `.output` into a production Node image. Declare runtime environment keys in the image without embedding deployment values: `DATABASE_URL`, `OTEL_COLLECTOR_URL`, `PROJECT_ID`, and `PORT` (default `3000`). Set the server host to `0.0.0.0` so the container accepts published traffic.

Use `docker-compose.yml` to build and run the app with a MySQL service, named persistent database volume, health check, and app dependency on healthy MySQL. Keep the Collector external; set `OTEL_COLLECTOR_URL` in the app container to the Collector endpoint. Configure the Collector separately to export service telemetry to the app's `/v1/traces` and `/v1/logs` routes.

Use `DATABASE_URL` for the app's MySQL connection, with `mysql` as the Compose hostname. Use `PROJECT_ID` as the data namespace and OpenTelemetry resource attribute. Use `PORT` as the app listener and published port. Track `.env.example` with placeholders; operators create ignored `.env` for local and Compose values. Exclude `.env` and credentials from the Docker build context, and inject values at container runtime rather than baking them into image layers.

### Use focused configuration and feature boundaries

Keep `DATABASE_URL`, `OTEL_COLLECTOR_URL`, `PROJECT_ID`, `PORT`, the telemetry ingestion token, request timeout, and telemetry quiet/max-wait intervals in server runtime configuration. Keep client state limited to the loaded canvas, panel drafts, filters, and active run. Save configuration only on explicit Save actions; discard restores the last saved values.

## Risks / Trade-offs

- Services without OpenTelemetry instrumentation or trace-context propagation produce incomplete flows. Show the call response even when no trace arrives, and mark the flow incomplete after the maximum wait.
- A quiet interval can return before a late span arrives. Bound the wait and leave later logs available in the log panel.
- MySQL telemetry volume can grow without limit. Add retention only after expected volume and deployment policy are known.
- Server-side calls to manually entered URLs can reach unintended hosts. Restrict outbound targets to the deployment's service network before exposing this app to untrusted users.
- A missing or misconfigured runtime variable can prevent startup or break telemetry. Document each variable in `.env.example` and fail clearly when required values are absent.
- Baking credentials into an image makes them recoverable from image layers. Keep actual values in ignored `.env` or deployment secrets and pass them at runtime.

## Migration Plan

There is no existing product schema or user data to migrate. Add Drizzle schema and migrations, configure `.env`, build the Docker image, and deploy the Compose app and MySQL services. Rollback by reverting the app image; keep the named database volume until operators confirm they no longer need saved graphs or telemetry.

## Open Questions

- What telemetry retention period and cleanup schedule fit the expected log and trace volume?

## References

- [Vue Flow guide](https://vueflow.dev/guide/)
- [Nuxt server engine](https://nuxt.com/docs/guide/concepts/server-engine/)
- [Drizzle ORM with MySQL](https://orm.drizzle.team/docs/get-started/mysql-new)
- [OpenTelemetry Protocol specification](https://opentelemetry.io/docs/specs/otlp/)
- [Docker Compose environment configuration](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/)
- [Dockerfile reference](https://docs.docker.com/reference/dockerfile)
