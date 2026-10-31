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
| `PUT /api/mock-api-settings`            | `mockApiSettingsSaveRequestSchema`                                              | `mockApiSettingsSaveResponseSchema`       |
| `GET /api/logs`                         | `logListRequestSchema`                                                          | `logListResponseSchema`                   |
| `POST /v1/logs`                         | `otlpLogsRequestSchema`                                                         | `otlpIngestResponseSchema`                |
| `POST /v1/traces`                       | `otlpTracesRequestSchema`                                                       | `otlpIngestResponseSchema`                |

OTLP payloads retain their collector-defined nested attributes. The shared schema validates the top-level resource collection while the ingestion workflow validates and normalizes nested records.

## Mock API settings

`PUT /api/mock-api-settings` saves staged environment variables, header templates, and mock APIs in one project-scoped transaction. The request carries the complete staged lists; omitted saved rows are deleted. The response returns `idMap` entries from client draft IDs to persisted IDs. Invalid foreign or stale references reject the transaction without partial writes.

Environment variable Update remains an immediate `PUT /api/environment-variables/:id` action. If its rename or value edit invalidates an active mock API, Cairn deactivates that API in the same transaction. Staged deletions, template edits/deletions, API edits, and endpoint changes are checked transactionally as well. Fixing a dependency clears readiness reasons but never automatically reactivates an API.

## Headers and readiness

An API can reference one live header template and add custom rows. Header names merge case-insensitively; a custom row overrides the template row with the same name, including when its value is empty. `{{name}}` values resolve from project environment variables at run time. Cairn owns `traceparent`; imported or custom values cannot override it. Header values are not copied into warnings or readiness diagnostics.

Mock APIs derive `Draft`, `Inactive`, or `Ready` from endpoint selection, path values, variables, headers, and the saved Active setting. Drafts can be saved without a matched endpoint, but only Ready APIs can run. A dependency repair does not turn Active back on. Imported APIs start inactive.

## Postman imports

Import APIs and Import environment are separate actions. Collection variables are used only as URL matching fallbacks and never create Cairn variable cards. Cairn's saved and staged variables take precedence for URL matching. Enabled explicit request headers are copied to that API's custom rows; disabled headers are omitted, and no header template is created implicitly. Unsupported authorization and scripts produce request warnings and are not executed.

Environment JSON accepts enabled string, number, and boolean entries; values become strings, including empty strings. Invalid names, unsupported values, and duplicate names are skipped with warnings. Existing and staged variable values are never overwritten. Invalid environment JSON changes no drafts.

Collection requests that cannot match a registered REST method and full URL are kept as inactive drafts with their source method/URL. Import warnings identify unsupported data or the mismatch without exposing header values. Missing URL, body, path, or header variables appear as readiness reasons. Importing the missing variable or changing an endpoint can retry an unresolved automatic match; manually selected endpoints are preserved. Importing APIs before or after environment variables both works. Save persists staged edits atomically; Discard restores saved cards and drafts. Per-header enable/disable checkboxes remain a future TODO.
