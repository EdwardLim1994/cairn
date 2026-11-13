# Backend module inventory

This inventory records the ownership boundary for `backend-modular-monolith`. The current
route paths and payloads remain the public HTTP contract; module `index.ts` files will
be the public TypeScript contract. `PROJECT_ID` remains mandatory for every persisted
query and mutation.

| Module                        | Owned tables                                                                               | Public operations and current route contracts                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project and access            | SQLite `projects`, `otel_access_tokens`                                                    | Resolve project; login/session/logout; list, create, revoke, and validate OTLP access tokens (`/api/auth/*`, `/api/access-tokens/*`).                                                              |
| Service registry              | SQLite `services`, `service_endpoints`                                                     | List, create, update, delete, and health targets (`/api/services/*`); proto parse and cleanup coordination.                                                                                        |
| Graph and canvas              | SQLite `graph_node_positions`, `service_edges`, `message_connections`                      | Get and save the full canvas (`/api/canvas`); position and edge operations used by service and destination workflows.                                                                              |
| Message destinations          | SQLite `message_destinations`                                                              | List destination records and broker health targets (`/api/message-destinations/health`). Connection persistence belongs to graph and canvas.                                                       |
| Mock APIs and shared settings | SQLite `mock_apis`, `header_templates`, `authorization_templates`, `environment_variables` | Mock API CRUD and readiness, template/settings save, variable CRUD and value resolution (`/api/mock-apis/*`, `/api/mock-api-settings`, `/api/environment-variables/*`).                            |
| Runs and call history         | SQLite `runs`, `mock_api_call_history`                                                     | Execution target, create/finish/find run, flow metadata, list/delete/clear history (`/api/mock-apis/*/runs`, `/api/runs/*`, `/api/mock-api-call-history/*`).                                       |
| Observability                 | DuckDB `spans`, `logs`                                                                     | Ingest and query OTLP spans/logs, service names, failure logs, retention (`/v1/traces`, `/v1/logs`, `/api/logs`). Run flow joins by `(projectId, traceId)` in the use case, never cross-store SQL. |

## Current seams to replace

- `server/repositories/services/index.ts` writes service and endpoint rows, graph positions, and mock API readiness within a SQLite transaction. Service use cases should coordinate public operations from the three owners.
- `server/repositories/canvas/index.ts` reads and writes service, destination, graph, and mock API records for the full canvas contract. The canvas use case should compose owner operations while graph persistence remains with graph and canvas.
- `server/repositories/mock-api-settings.ts` performs a cross-table settings transaction. The mock API module owns templates and APIs; variables belong to the same shared settings module for readiness coordination.
- `server/repositories/runs/index.ts` reads mock API execution targets as well as run and call history rows. The mock API module should expose target resolution to run use cases.
- API handlers currently import repository internals directly. Preserve their HTTP responses while routing through public module operations or endpoint use cases.
- DuckDB writes are serialized in `server/db/telemetry.ts`; SQLite application transactions use `server/db/sqlite.ts`. Their commit and retry boundary must stay explicit.

Existing route contract tests are under `server/api/*.integration.test.ts` and
`server/routes/v1/*.integration.test.ts`. Existing repository, use-case, and database
tests characterize query behavior before movement into each module's `_test_` directory.
