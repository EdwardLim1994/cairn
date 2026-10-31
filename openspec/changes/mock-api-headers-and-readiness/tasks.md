# Tasks

## 1. Persistence and shared contracts

- [x] 1.1 Add project-scoped header templates, mock API template association/custom header rows, activation, and unresolved import metadata to Drizzle schema; generate SQL and metadata with `vp run db:generate` and verify both fresh and existing database migrations preserve request data and run history.
- [x] 1.2 Extend shared mock API/canvas contracts and frontend models for nullable draft endpoints, template rows, activation, import metadata, and readiness reasons; verify parsing accepts incomplete inactive drafts while rejecting structurally unsafe values.
- [x] 1.3 Add template and mock API persistence operations with project ownership checks and safe template detachment/deletion; verify MySQL integration tests cover isolation, retained custom headers, and rollback on write failure.

## 2. Effective headers and readiness

- [x] 2.1 Implement shared string-variable reference scanning/resolution using existing syntax and string semantics; verify tests cover embedded references, undefined names, empty values, and JSON string traversal without treating values as typed JSON.
- [x] 2.2 Implement header validation and case-insensitive template/custom merging; verify tests cover overrides, duplicates within one table, blank values, overridden missing variables, CR/LF including resolved values, invalid names, and protected `traceparent`.
- [x] 2.3 Implement the shared readiness evaluator and Draft/Inactive/Ready derivation; verify tests cover null/missing endpoints, missing path values, variable/header errors, valid inactive requests, and no automatic reactivation.
- [x] 2.4 Extend execution-target loading and run preflight to enforce saved activation/readiness and apply effective headers before fetch; verify run tests prove no outbound call for blocked APIs and correct GET/non-GET headers, tracing, JSON defaults, and explicit content type overrides.
- [x] 2.5 Reconcile legacy active candidates on saved reads before enabling triggers; verify existing valid APIs remain usable and incomplete legacy APIs become inactive without losing graph/request/history data.

## 3. Saved mutations and panel persistence

- [x] 3.1 Add a focused settings-save contract/use case/route for staged variables, templates, and mock APIs with draft ID mapping; verify transaction tests cover creating a template and referencing API together, incomplete draft persistence, rejected stale/foreign references, and no partial save on failure.
- [x] 3.2 Revalidate and persist affected API deactivation inside saved variable, template, and endpoint mutation transactions, including immediate variable Update; verify integration tests cover rename/delete/edit invalidation, unaffected APIs, and no automatic reactivation after repairs.
- [x] 3.3 Implement confirmed template detach/delete as one saved transaction while retaining custom headers; verify cancellation causes no mutation and confirmed Save cannot leave dangling associations.
- [x] 3.4 Extend API client/store/view model snapshots and replace staged sequential settings writes with the transactional save flow; verify view model tests cover new draft IDs, Save failure, Discard restoration, and saved-versus-staged activation.
- [x] 3.5 Document the new settings-save and template contracts plus the existing immediate variable Update exception; verify documentation matches request/response schemas and the resulting deactivation behavior.

## 4. Separate Postman imports

- [x] 4.1 Add a Postman environment parser with duplicate detection against saved/staged/imported names; verify parser tests cover skip-with-warning collisions, invalid names, disabled entries, empty strings, scalar conversion, unsupported values, and invalid-file no-op behavior.
- [x] 4.2 Extend collection parsing to retain enabled explicit header rows and preserve placeholders without creating templates; verify tests cover disabled rows, invalid/protected headers, and request-specific warnings for unsupported inherited/request authorization and scripts.
- [x] 4.3 Accept current Cairn variable drafts for URL matching with collection-variable fallback, preserve unresolved source metadata, and retain unmatched requests inactive; verify tests cover existing normalized URL/method/path matching, unresolved base URL, method mismatch, and unsupported non-JSON body warnings.
- [x] 4.4 Add draft diagnostics and retry matching on variable/endpoint changes without replacing manual endpoint selection; verify view model tests cover both import orders, Save/reload before environment import, clearing missing-variable warnings, and no automatic activation.
- [x] 4.5 Connect separate Import environment and Import APIs actions to staged cards and warnings; verify panel/view model tests prove duplicate variables are untouched and Discard removes both unsaved import types.
- [x] 4.6 Document separate imports, collection versus environment variables, skipped/unsupported fields, and resolving unmatched drafts; verify examples cover both import orders and reflect parser behavior.

## 5. Header and activation UI

- [x] 5.1 Add named header template cards and editable name/value rows to Mock APIs settings using Nuxt UI and existing BEM/theme patterns; verify component tests cover new/edit cards, row addition/removal, and staged Save/Discard.
- [x] 5.2 Add zero-or-one template selector plus custom header table below each API URL display; verify component tests cover template selection, custom overrides, and omission of per-header disable checkboxes.
- [x] 5.3 Add deletion confirmation listing affected APIs and stage detachment on confirmation; verify component/view model tests cover Cancel, Confirm, retained custom rows, and restoration on Discard.
- [x] 5.4 Add Active switch and readiness status/reasons to API cards, including automatic staged deactivation; verify tests cover missing dependencies, restoring variables without reactivation, explicit activation, and Save/Discard.
- [x] 5.5 Update Mock APIs graph nodes and canvas mapping for unmatched drafts and persisted readiness; verify graph tests cover no invalid edges, disabled triggers, and unsaved activation not enabling saved execution.
- [x] 5.6 Document header precedence, live template references, template deletion, statuses, activation, and the deferred per-header checkbox TODO; verify UI labels and examples match implemented behavior.

## 6. Panel edit preservation

- [x] 6.1 Remove outside-click dismissal from Service and Mock APIs settings and any equivalent parent handlers for Logs/Latest run; verify component tests show outside clicks preserve open state and unfinished edits for each panel.
- [x] 6.2 Preserve explicit controls, Escape where currently supported, and transient menu/select/dialog dismissal; verify focused keyboard and interaction tests and document the outside-click behavior.

## 7. Integration validation

- [x] 7.1 Run an end-to-end MySQL-backed scenario importing APIs before environment, saving unmatched inactive drafts, importing variables, matching, selecting a template, activating, and triggering; verify effective outbound headers and retained trace correlation.
- [x] 7.2 Run the reverse import order and dependency-deletion scenarios; verify transactional Save/Discard, confirmation behavior, persisted automatic deactivation, direct run rejection, and absence of header values in warnings.
- [x] 7.3 Run `vp check <changed paths>`, focused `vp test run <test paths>`, necessary `vp run test:integration`, and `vp run build`; record results and any unavailable infrastructure without marking unrun checks complete.
- [x] 7.4 Validate `mock-api-headers-and-readiness` and the existing `service-graph-editor` change with `openspec validate <change> --strict`; verify implementation behavior and planning artifacts remain consistent.

## Deferred TODO

- Add enable/disable checkboxes on every header row in a future change. Define per-API inherited-header omission and override behavior before implementation; this TODO is outside the tracked implementation scope above.
