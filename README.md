# Service Graph Editor

A Nuxt single page app for editing a microservice graph, triggering registered REST calls, and viewing correlated traces and logs. The graph and telemetry are scoped to `PROJECT_ID` and stored in MySQL.

## Run with Docker Compose

1. Copy `.env.example` to `.env` and replace the `replace-me` database passwords and ingestion token.
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

Open `http://localhost:3000`. The app container reaches MySQL at `mysql:3306`; host-run Drizzle commands use the `localhost:3306` URL in `.env`. MySQL data persists in the `mysql_data` named volume. `docker compose down` stops the services and keeps that volume. To remove the database volume as well, use `docker compose down --volumes`.

The production image contains the Nuxt `.output` bundle. Runtime values are injected by Compose; credentials are not copied into the image. `PORT` sets both the app listener and published port.

## Environment

| Variable                      | Purpose                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                | MySQL URL. Use `localhost` for host-run commands; Compose sets the app URL to the `mysql` service.                                                           |
| `OTEL_COLLECTOR_URL`          | HTTP(S) Collector receiver URL for this deployment. The app validates it at startup; service telemetry forwarding is configured in the Collector file below. |
| `PROJECT_ID`                  | Namespace shared by the graph and the OpenTelemetry `project.id` resource attribute.                                                                         |
| `PORT`                        | Nuxt server port (default `3000`).                                                                                                                           |
| `OTEL_INGEST_TOKEN`           | Bearer token required by the app's Collector ingestion routes. Set the same value in the Collector process environment.                                      |
| `OUTBOUND_REQUEST_TIMEOUT_MS` | Timeout for triggered service calls (default `10000`).                                                                                                       |
| `TELEMETRY_QUIET_MS`          | Quiet period before a trace flow is considered complete (default `1500`).                                                                                    |
| `TELEMETRY_MAX_WAIT_MS`       | Maximum time to wait for trace data before returning an incomplete flow (default `10000`).                                                                   |

Keep real values in the ignored `.env` file or your deployment secret store. `.env.example` contains placeholders only.

## OpenTelemetry Collector

Run the Collector separately from this Compose project and attach it and instrumented services to a Docker network where they can resolve the app as `app`. `otel-collector-config.yaml` accepts OTLP/HTTP and OTLP/gRPC input on ports `4318` and `4317`; its `otlp_http/app` exporter sends JSON to `http://app:3000/v1/traces` and `/v1/logs`, with the app's required bearer token. If you change `PORT`, update the exporter endpoint to the same container port. Start the Collector with `OTEL_INGEST_TOKEN` set to the same value as the app.

Configure each instrumented service to send telemetry to the Collector and set the resource attributes:

```text
OTEL_SERVICE_NAME=checkout
OTEL_RESOURCE_ATTRIBUTES=project.id=local
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
```

Use your actual `PROJECT_ID` in `OTEL_RESOURCE_ATTRIBUTES`. Service SDKs should propagate W3C trace context so their spans share the trace ID created by a mock API run. The app only overlays observed spans; configured graph edges do not stand in for telemetry.

The Collector ingestion routes are `POST /v1/traces` and `POST /v1/logs`. Both expect an OTLP/HTTP JSON body and `Authorization: Bearer <OTEL_INGEST_TOKEN>`. `/api/runs/:id/flow` reports pending data, then returns observed service edges and error services when telemetry is quiet or the maximum wait expires. `/api/logs` accepts optional `service`, `severity`, and `search` query parameters.

## Local development

Start MySQL and migrate as shown above, then run:

```sh
vp run dev
```

For local development, `.env` must use `DATABASE_URL=mysql://…@localhost:3306/…`. Use `vp run build` to produce the production bundle. The collector and instrumented services are not started by this command.

## API overview

- `GET/PUT /api/canvas`
- `GET/POST /api/services`, `PUT/DELETE /api/services/:id`
- `GET/POST /api/mock-apis`, `PUT/DELETE /api/mock-apis/:id`
- `POST /api/mock-apis/:id/runs`, `GET /api/runs/:id`, `GET /api/runs/:id/flow`
- `GET /api/logs`
- `POST /v1/traces`, `POST /v1/logs` (bearer-token protected)
