# CAIRN - Service Graph Editor

[![Unit tests](https://github.com/EdwardLim1994/cairn/actions/workflows/unit-tests.yml/badge.svg?branch=main)](https://github.com/EdwardLim1994/cairn/actions/workflows/unit-tests.yml)
[![Integration tests](https://github.com/EdwardLim1994/cairn/actions/workflows/integration-tests.yml/badge.svg?branch=main)](https://github.com/EdwardLim1994/cairn/actions/workflows/integration-tests.yml)
[![SonarCloud Scan](https://github.com/EdwardLim1994/cairn/actions/workflows/sonarcloud.yml/badge.svg?branch=main)](https://github.com/EdwardLim1994/cairn/actions/workflows/sonarcloud.yml)

A Nuxt single page app for editing a microservice graph, triggering registered REST calls, and viewing correlated traces and logs. The graph and telemetry are scoped to `PROJECT_ID` and stored in MySQL.

GitHub Actions reports unit/component tests and MySQL-backed integration tests in separate workflows, so their README badges show independent status. The unit workflow also checks formatting, lint, and types. The SonarCloud workflow runs unit and component tests with V8 coverage before scanning and reads `coverage/lcov.info`. SonarCloud analysis runs on pushes and pull requests after configuring the repository with a `SONAR_TOKEN` secret and `SONAR_PROJECT_KEY` and `SONAR_ORGANIZATION` repository variables. The scan badge stays inactive until the project variables are set.

## Run with Docker Compose

1. Copy `.env.example` to `.env`. Replace database and operator passwords, then generate a session secret with `openssl rand -hex 32`.
2. Build and start the stack:

   ```sh
   docker compose up -d --build
   ```

After MySQL is healthy, the app container applies pending Drizzle migrations before starting Cairn. A fresh database receives all migrations; subsequent starts skip recorded migrations. Migration failures stop the container before the web server starts. Generate new migrations with `vp run db:generate`, commit the SQL and metadata, then rebuild the image. Run one app container during migration; concurrent migration runners are not supported.

Open `http://localhost:3002`. The app container reaches MySQL at `mysql:3306`; host-run Drizzle commands use the `localhost:3307` URL in `.env`. MySQL data persists in the `mysql_data` named volume. `docker compose down` stops the services and keeps that volume. To remove the database volume as well, use `docker compose down --volumes`.

Register microservices in Cairn with the same `http://localhost:<port>` base URLs used by Postman. The Java and .NET Compose projects publish those ports through Traefik. Inside the Cairn container, `OUTBOUND_HOST_GATEWAY=host.docker.internal` rewrites localhost service targets to Docker's host gateway, so Cairn can reach each project's proxy without joining their Docker networks. Host-run development leaves service URLs unchanged.

The production image contains the Nuxt `.output` bundle, a bundled migration runner, and Drizzle migration files. Runtime values are injected by Compose; credentials are not copied into the image. `PORT` sets both the app listener and published port.

## Environment

| Variable                      | Purpose                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                | MySQL URL. Use `localhost:3307` for host-run commands; Compose sets the app URL to the `mysql` service on port `3306`.                                       |
| `MYSQL_PORT`                  | Host port for the Compose MySQL instance (Compose default `3306`; `.env.example` sets `3307`). The container still listens on port `3306`.                   |
| `OTEL_COLLECTOR_URL`          | HTTP(S) Collector receiver URL for this deployment. The app validates it at startup; service telemetry forwarding is configured in the Collector file below. |
| `PROJECT_ID`                  | Namespace shared by the graph and the OpenTelemetry `project.id` resource attribute.                                                                         |
| `PORT`                        | Nuxt server port (default `3003`; `.env.example` sets `3002`).                                                                                               |
| `AUTH_ENABLED`                | Enables shared operator authentication by default. Set to `false` only for trusted deployments.                                                              |
| `AUTH_USERNAME`               | Shared operator username. Required when authentication is enabled.                                                                                           |
| `AUTH_PASSWORD`               | Shared operator password. Required when authentication is enabled.                                                                                           |
| `AUTH_SESSION_SECRET`         | Secret used to encrypt sessions. Required with at least 32 characters; generate with `openssl rand -hex 32`.                                                 |
| `OUTBOUND_REQUEST_TIMEOUT_MS` | Timeout for triggered service calls (default `10000`).                                                                                                       |
| `OUTBOUND_HOST_GATEWAY`       | Optional Docker-only hostname used to route localhost service URLs through host-published proxies. Compose sets this to `host.docker.internal`.              |
| `TELEMETRY_QUIET_MS`          | Quiet period before a trace flow is considered complete (default `1500`).                                                                                    |
| `TELEMETRY_MAX_WAIT_MS`       | Maximum time to wait for trace data before returning an incomplete flow (default `10000`).                                                                   |

Keep real values in the ignored `.env` file or your deployment secret store. `.env.example` contains placeholders only.

## OpenTelemetry Collector

Run the Collector separately from this Compose project and attach it and instrumented services to a Docker network where they can resolve the app as `app`. `otel-collector-config.yaml` accepts OTLP/HTTP and OTLP/gRPC input on ports `4318` and `4317`; its `otlp_http/app` exporter sends JSON to `http://app:3002/v1/traces` and `/v1/logs` with a bearer token. If you change `PORT`, update the exporter endpoint to the same container port.

Create a token from **Manage access tokens** in Cairn. Set its required expiry date and copy the secret when Cairn shows it; Cairn cannot show it again. Supply the copied value as the Collector's `CAIRN_OTEL_ACCESS_TOKEN` environment secret. Do not commit the secret. The example Collector configuration reads this variable and sends it in the `Authorization` header. Generate a replacement before expiry, verify ingestion, then revoke the old token. Revocation takes effect immediately. Expired tokens stop working and remain listed as expired until revoked.

This token protects OTLP ingestion routes. The management UI and management APIs require the shared operator login by default. Use `AUTH_ENABLED=false` only on trusted networks. Use TLS when Collector traffic crosses an untrusted network; bearer authentication does not encrypt HTTP traffic.

Configure each instrumented service to send telemetry to the Collector and set the resource attributes:

```text
OTEL_SERVICE_NAME=checkout
OTEL_RESOURCE_ATTRIBUTES=project.id=local
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
```

Use your actual `PROJECT_ID` in `OTEL_RESOURCE_ATTRIBUTES`. Service SDKs should propagate W3C trace context so their spans share the trace ID created by a mock API run. The app only overlays observed spans; configured graph edges do not stand in for telemetry.

The Collector ingestion routes are `POST /v1/traces` and `POST /v1/logs`. Both require an active, unexpired bearer token. `/api/runs/:id/flow` reports pending data, then returns observed service edges and error services when telemetry is quiet or the maximum wait expires. `/api/logs` accepts optional `service`, `severity`, and `search` query parameters.

## Local development

For host-run development, start MySQL and apply migrations before starting Nuxt:

```sh
docker compose up -d mysql
vp install
vp run db:migrate
vp run dev
```

For local development, `.env` must use `DATABASE_URL=mysql://<user>:<password>@localhost:3307/<database>`. Set `AUTH_USERNAME`, `AUTH_PASSWORD`, and `AUTH_SESSION_SECRET`; generate the session secret with `openssl rand -hex 32`. Use `vp run build` to produce the production bundle. The collector and instrumented services are not started by this command.

Run the unit and component tests with LCOV coverage locally using:

```sh
vp run test:coverage
```

This excludes the MySQL integration tests, which run separately through `vp run test:integration` with `CAIRN_TEST_DATABASE_URL` set. The coverage report is written to the ignored `coverage/lcov.info` path. The SonarCloud workflow creates a fresh report before analysis, so no artifact upload between workflows is needed.

## API overview

- `GET/PUT /api/canvas`
- `GET/POST /api/services`, `PUT/DELETE /api/services/:id`
- `GET/POST /api/mock-apis`, `PUT/DELETE /api/mock-apis/:id`
- `GET/POST /api/environment-variables`, `PUT/DELETE /api/environment-variables/:id`
- `GET/POST /api/access-tokens`, `DELETE /api/access-tokens/:id`
- `POST /api/mock-apis/:id/runs`, `GET /api/runs/:id`, `GET /api/runs/:id/flow`
- `GET /api/logs`
- `POST /v1/traces`, `POST /v1/logs`

## Mock API requests

Mock APIs call a registered service endpoint and store a JSON request body. Endpoint URLs may include route parameters such as `/orders/{orderId}`; each mock API stores values for those parameters and URL-encodes them when making the request.

The Mock APIs panel can import Postman collection JSON. Cairn imports only REST requests whose full URL and HTTP method match a registered endpoint, and shows a warning for each skipped request. Route parameter values are copied into the new mock API.

The panel also supports one shared set of string environment variables per project. Use `{{variableName}}` in request JSON string values or path parameter values. **New variable** adds an editable card; the panel's **Save** button persists new variables, deletions, and mock API changes together. Editing an existing card uses **Update** to save its name or value immediately; unchanged values do not issue an update request.

The **Shareable authorization templates** section supports **Bearer token**, **Basic Auth**, **API key**, and **OAuth 2.0 Client Credentials**. Create a template there, then choose it in a mock API's **Authorization** accordion; APIs without a selection use **No Auth**. Credential fields accept project variable references. OAuth uses a server-side form-encoded Client Credentials request with `client_secret_basic`, token URL, client ID, client secret, and optional scope. Cairn caches tokens in memory until shortly before their `expires_in` time. Authorization Code and provider-specific token parameters are not supported.

Bearer, Basic, and OAuth send an `Authorization` header; API key sends the configured key as a request header. A raw header template or custom header with the same name, ignoring case, makes that API not ready until the conflict is removed. Authorization secrets are masked while editing and are stored with project settings in MySQL; this does not encrypt them or restrict access from trusted Cairn operators. Postman collection authorization is not imported and remains reported as an unsupported feature.

Services can use REST endpoints or one GraphQL endpoint. GraphQL mock APIs store `query`, JSON `variables`, and optional `operationName` in the request field. The editor checks GraphQL syntax without a service schema; schema-aware validation and autocomplete remain deferred. Postman import remains REST-only.
