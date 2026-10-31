# Service Graph Editor

[![Tests](https://github.com/EdwardLim1994/cairn/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/EdwardLim1994/cairn/actions/workflows/ci.yml)
[![SonarCloud Scan](https://github.com/EdwardLim1994/cairn/actions/workflows/sonarcloud.yml/badge.svg?branch=main)](https://github.com/EdwardLim1994/cairn/actions/workflows/sonarcloud.yml)

A Nuxt single page app for editing a microservice graph, triggering registered REST calls, and viewing correlated traces and logs. The graph and telemetry are scoped to `PROJECT_ID` and stored in MySQL.

GitHub Actions runs unit, component, and MySQL-backed integration tests in the CI workflow. SonarCloud analysis runs separately on pushes and pull requests after configuring the repository with a `SONAR_TOKEN` secret and `SONAR_PROJECT_KEY` and `SONAR_ORGANIZATION` repository variables. The scan badge stays inactive until the project variables are set.

## Run with Docker Compose

1. Copy `.env.example` to `.env` and replace the `replace-me` database passwords.
2. Start MySQL and apply the Drizzle migration from the host:

   ```sh
   docker compose up -d mysql
   vp install
   vp run db:migrate
   ```

3. Build and start the app:

   ```sh
   docker compose up -d --build app
   ```

Open `http://localhost:3001`. The app container reaches MySQL at `mysql:3306`; host-run Drizzle commands use the `localhost:3306` URL in `.env`. MySQL data persists in the `mysql_data` named volume. `docker compose down` stops the services and keeps that volume. To remove the database volume as well, use `docker compose down --volumes`.

Register microservices in Cairn with the same `http://localhost:<port>` base URLs used by Postman. The Java and .NET Compose projects publish those ports through Traefik. Inside the Cairn container, `OUTBOUND_HOST_GATEWAY=host.docker.internal` rewrites localhost service targets to Docker's host gateway, so Cairn can reach each project's proxy without joining their Docker networks. Host-run development leaves service URLs unchanged.

The production image contains the Nuxt `.output` bundle. Runtime values are injected by Compose; credentials are not copied into the image. `PORT` sets both the app listener and published port.

## Environment

| Variable                      | Purpose                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                | MySQL URL. Use `localhost` for host-run commands; Compose sets the app URL to the `mysql` service.                                                           |
| `OTEL_COLLECTOR_URL`          | HTTP(S) Collector receiver URL for this deployment. The app validates it at startup; service telemetry forwarding is configured in the Collector file below. |
| `PROJECT_ID`                  | Namespace shared by the graph and the OpenTelemetry `project.id` resource attribute.                                                                         |
| `PORT`                        | Nuxt server port (default `3001`).                                                                                                                           |
| `OUTBOUND_REQUEST_TIMEOUT_MS` | Timeout for triggered service calls (default `10000`).                                                                                                       |
| `OUTBOUND_HOST_GATEWAY`       | Optional Docker-only hostname used to route localhost service URLs through host-published proxies. Compose sets this to `host.docker.internal`.              |
| `TELEMETRY_QUIET_MS`          | Quiet period before a trace flow is considered complete (default `1500`).                                                                                    |
| `TELEMETRY_MAX_WAIT_MS`       | Maximum time to wait for trace data before returning an incomplete flow (default `10000`).                                                                   |

Keep real values in the ignored `.env` file or your deployment secret store. `.env.example` contains placeholders only.

## OpenTelemetry Collector

Run the Collector separately from this Compose project and attach it and instrumented services to a Docker network where they can resolve the app as `app`. `otel-collector-config.yaml` accepts OTLP/HTTP and OTLP/gRPC input on ports `4318` and `4317`; its `otlp_http/app` exporter sends JSON to `http://app:3001/v1/traces` and `/v1/logs`, without bearer authentication. If you change `PORT`, update the exporter endpoint to the same container port.

Configure each instrumented service to send telemetry to the Collector and set the resource attributes:

```text
OTEL_SERVICE_NAME=checkout
OTEL_RESOURCE_ATTRIBUTES=project.id=local
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
```

Use your actual `PROJECT_ID` in `OTEL_RESOURCE_ATTRIBUTES`. Service SDKs should propagate W3C trace context so their spans share the trace ID created by a mock API run. The app only overlays observed spans; configured graph edges do not stand in for telemetry.

The Collector ingestion routes are `POST /v1/traces` and `POST /v1/logs`. Both accept OTLP/HTTP JSON bodies without bearer authentication for this temporary local setup. `/api/runs/:id/flow` reports pending data, then returns observed service edges and error services when telemetry is quiet or the maximum wait expires. `/api/logs` accepts optional `service`, `severity`, and `search` query parameters.

## Local development

Start MySQL and migrate as shown above, then run:

```sh
vp run dev
```

For local development, `.env` must use `DATABASE_URL=mysql://<user>:<password>@localhost:3306/<database>`. Use `vp run build` to produce the production bundle. The collector and instrumented services are not started by this command.

## API overview

- `GET/PUT /api/canvas`
- `GET/POST /api/services`, `PUT/DELETE /api/services/:id`
- `GET/POST /api/mock-apis`, `PUT/DELETE /api/mock-apis/:id`
- `GET/POST /api/environment-variables`, `PUT/DELETE /api/environment-variables/:id`
- `POST /api/mock-apis/:id/runs`, `GET /api/runs/:id`, `GET /api/runs/:id/flow`
- `GET /api/logs`
- `POST /v1/traces`, `POST /v1/logs`

## Mock API requests

Mock APIs call a registered service endpoint and store a JSON request body. Endpoint URLs may include route parameters such as `/orders/{orderId}`; each mock API stores values for those parameters and URL-encodes them when making the request.

The Mock APIs panel can import Postman collection JSON. Cairn imports only REST requests whose full URL and HTTP method match a registered endpoint, and shows a warning for each skipped request. Route parameter values are copied into the new mock API.

The panel also supports one shared set of string environment variables per project. Use `{{variableName}}` in request JSON string values or path parameter values. **New variable** adds an editable card; the panel's **Save** button persists new variables, deletions, and mock API changes together. Editing an existing card uses **Update** to save its name or value immediately; unchanged values do not issue an update request.

Mock API request bodies use a JSON-aware CodeMirror editor with formatting, syntax diagnostics, placeholder highlighting, and shared-variable autocomplete. GraphQL request syntax and chained API calls remain future enhancements.
