# Backend module inventory

This inventory records the ownership boundary for `backend-modular-monolith`. The current
route paths and payloads remain the public HTTP contract; module `index.ts` files are
the public TypeScript contract. `PROJECT_ID` remains mandatory for every persisted
query and mutation.

| Module                        | Owned tables                                                                               | Public operations and current route contracts                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project and access            | SQLite `projects`, `otel_access_tokens`                                                    | Resolve project; login/session/logout; list, create, revoke, and validate OTLP access tokens (`/api/auth/*`, `/api/access-tokens/*`).                                                                           |
| Service registry              | SQLite `services`, `service_endpoints`                                                     | List, create, update, delete, and health targets (`/api/services/*`); proto parse and cleanup coordination.                                                                                                     |
| Graph and canvas              | SQLite `graph_node_positions`, `service_edges`, `message_connections`                      | Get and save the full canvas (`/api/canvas`); position and edge operations used by service and destination workflows.                                                                                           |
| Message destinations          | SQLite `message_destinations`                                                              | List destination records and broker health targets (`/api/message-destinations/health`). Connection persistence belongs to graph and canvas.                                                                    |
| Mock APIs and shared settings | SQLite `mock_apis`, `header_templates`, `authorization_templates`, `environment_variables` | Mock API CRUD and readiness, template/settings save, variable CRUD and value resolution (`/api/mock-apis/*`, `/api/mock-api-settings`, `/api/environment-variables/*`).                                         |
| Runs and call history         | SQLite `runs`, `mock_api_call_history`                                                     | Create/finish/find run, flow metadata, list/delete/clear history (`/api/mock-apis/*/runs`, `/api/runs/*`, `/api/mock-api-call-history/*`). Mock API execution target resolution belongs to the mock API module. |
| Observability                 | DuckDB `spans`, `logs`                                                                     | Ingest and query OTLP spans/logs, service names, failure logs, retention (`/v1/traces`, `/v1/logs`, `/api/logs`). Run flow joins by `(projectId, traceId)` in the use case, never cross-store SQL.              |

## Coordination boundaries

- Service create, update, and delete use cases coordinate service rows, graph positions, and mock API readiness in one SQLite transaction. Legacy repository write entry points remain for compatibility with existing callers.
- The canvas repository serves the full canvas contract and delegates message destination persistence to its owning module.
- The mock API module owns its settings transaction, including templates, variables, and readiness.
- The runs module stores run and call history records; the mock API module resolves execution targets. Run flow composition calls public module operations.
- Route handlers use module public operations or endpoint use cases.
- DuckDB writes are serialized in `server/db/telemetry.ts`; SQLite application transactions use `server/db/sqlite.ts`. DuckDB ingestion commits before SQLite run arrival metadata is recorded, so retries remain safe.

Existing route contract tests are under `server/api/*.integration.test.ts` and
`server/routes/v1/*.integration.test.ts`. Existing repository, use-case, and database
tests characterize query behavior before movement into each module's `_test_` directory.
