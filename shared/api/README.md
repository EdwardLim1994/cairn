# API contracts

These Zod schemas describe the existing REST and OTLP transport contracts. Request schemas cover path/query/body input as applicable; response schemas represent JSON over HTTP (database dates are ISO strings). Keep route behavior and these contracts aligned during the refactor.

| Route                                   | Request schema                                                                  | Response schema                           |
| --------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------- |
| `GET /api/canvas`                       | `canvasGetRequestSchema`                                                        | `canvasGetResponseSchema`                 |
| `PUT /api/canvas`                       | `canvasPutRequestSchema`                                                        | `canvasPutResponseSchema`                 |
| `GET /api/services`                     | `serviceListRequestSchema`                                                      | `serviceListResponseSchema`               |
| `POST /api/services`                    | `serviceCreateRequestSchema`                                                    | `serviceCreateResponseSchema`             |
| `PUT /api/services/:id`                 | `serviceIdRequestSchema` + `serviceUpdateRequestSchema`                         | `serviceUpdateResponseSchema`             |
| `DELETE /api/services/:id`              | `serviceIdRequestSchema`                                                        | `serviceDeleteResponseSchema`             |
| `GET /api/services/health`              | `serviceHealthRequestSchema`                                                    | `serviceHealthResponseSchema`             |
| `GET /api/mock-apis`                    | `mockApiListRequestSchema`                                                      | `mockApiListResponseSchema`               |
| `POST /api/mock-apis`                   | `mockApiCreateRequestSchema`                                                    | `mockApiCreateResponseSchema`             |
| `PUT /api/mock-apis/:id`                | `mockApiIdRequestSchema` + `mockApiUpdateRequestSchema`                         | `mockApiUpdateResponseSchema`             |
| `DELETE /api/mock-apis/:id`             | `mockApiIdRequestSchema`                                                        | `mockApiDeleteResponseSchema`             |
| `POST /api/mock-apis/:id/runs`          | `mockApiRunRequestSchema`                                                       | `mockApiRunResponseSchema`                |
| `GET /api/runs/:id`                     | `runGetRequestSchema`                                                           | `runGetResponseSchema`                    |
| `GET /api/runs/:id/flow`                | `runFlowRequestSchema`                                                          | `runFlowResponseSchema`                   |
| `GET /api/environment-variables`        | `environmentVariableListRequestSchema`                                          | `environmentVariableListResponseSchema`   |
| `POST /api/environment-variables`       | `environmentVariableCreateRequestSchema`                                        | `environmentVariableCreateResponseSchema` |
| `PUT /api/environment-variables/:id`    | `environmentVariableIdRequestSchema` + `environmentVariableUpdateRequestSchema` | `environmentVariableUpdateResponseSchema` |
| `DELETE /api/environment-variables/:id` | `environmentVariableIdRequestSchema`                                            | `environmentVariableDeleteResponseSchema` |
| `GET /api/logs`                         | `logListRequestSchema`                                                          | `logListResponseSchema`                   |
| `POST /v1/logs`                         | `otlpLogsRequestSchema`                                                         | `otlpIngestResponseSchema`                |
| `POST /v1/traces`                       | `otlpTracesRequestSchema`                                                       | `otlpIngestResponseSchema`                |

OTLP payloads retain their collector-defined nested attributes. The shared schema validates the top-level resource collection while the ingestion workflow validates and normalizes nested records.
