# Tasks

## 1. Data model and editor dependency

- [ ] 1.1 Add `cm6-graphql` and verify the GraphQL language extension imports and bundles with the existing CodeMirror editor.
- [ ] 1.2 Add service and mock API `apiType` fields with REST defaults; backfill existing data and migrate endpoint type to service type; verify migration preserves REST services, endpoints, mocks, and graph references.

## 2. GraphQL service endpoint

- [ ] 2.1 Update service and endpoint API schemas, validation, and repositories for service-level REST/GRAPHQL types and exactly one GraphQL endpoint; verify API tests cover REST compatibility and GraphQL endpoint constraints.
- [ ] 2.2 Update service settings to show one GraphQL endpoint URL field, hide OpenAPI import and endpoint add/remove controls, and save the GraphQL type; verify component tests cover GraphQL draft, save, and discard behavior.
- [ ] 2.3 Update graph data and graph-as-code formats to carry service-level API type and render one GraphQL endpoint; verify REST and GraphQL graphs round-trip with existing endpoint IDs.
- [ ] 2.4 Document GraphQL service endpoint configuration; verify documented fields and rules match service settings.

## 3. GraphQL mock API editing

- [ ] 3.1 Add explicit GraphQL mock API creation and type-matched target filtering; verify API and component tests reject REST targets for GraphQL mocks and GraphQL targets for REST mocks.
- [ ] 3.2 Add a GraphQL query editor with syntax validation and a JSON variables editor; store query, variables, and optional operation name in the existing request JSON field; verify component tests cover valid syntax, syntax errors, variables, and editor updates.
- [ ] 3.3 Document GraphQL mock request fields and syntax-only validation; verify documentation states that schema-aware validation and autocomplete are deferred.

## 4. GraphQL request execution

- [ ] 4.1 Send query and mutation requests as HTTP POST with JSON variables through the existing auth, timeout, and traceparent paths; verify use-case tests cover successful responses, HTTP errors, and connection failures.
- [ ] 4.2 Preserve GraphQL response JSON and HTTP status in run history, including `errors` returned with HTTP success; verify history and panel tests distinguish GraphQL response errors from transport failures.

## 5. REST compatibility and integration

- [ ] 5.1 Update Postman matching to import only REST mock API drafts; verify collection tests never target GraphQL endpoints or create GraphQL mocks.
- [ ] 5.2 Run focused service, GraphQL editor, execution, history, and Postman tests; then run `vp check` on changed paths and `openspec validate graphql-api-support --strict`.
