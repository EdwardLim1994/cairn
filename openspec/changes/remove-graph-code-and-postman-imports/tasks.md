# Tasks

## 1. Graph as Code removal

- [ ] 1.1 Remove the toolbar action, drawer, page state, editor, and API client call; update UI tests to verify manual graph controls remain and Graph as Code is absent.
- [ ] 1.2 Remove the graph manifest route, schema, serializer, repository, completion helper, and sample manifest; verify the old endpoint cannot apply data and remove feature-only tests.
- [ ] 1.3 Remove Graph as Code instructions from user documentation; verify graph setup instructions use the in-app controls.

## 2. Postman import removal

- [ ] 2.1 Remove collection and environment file controls, page handlers, import warning UI, retry watcher, and import view-model methods; update component and view-model tests to verify manual mock API, header, variable, and authorization flows.
- [ ] 2.2 Remove Postman parser utilities and import-only integration cases; verify manual mock API execution and variable resolution tests still pass.
- [ ] 2.3 Remove Postman import instructions from user and shared API documentation; verify OpenAPI and `.proto` setup instructions remain.

## 3. Contract and schema cleanup

- [ ] 3.1 Remove service, endpoint, and message destination `codeKey` fields from shared contracts and canvas validation; verify ID-based duplicate and relationship tests.
- [ ] 3.2 Remove mock API `importMethod`, `importUrl`, and `matchUrl` fields from shared contracts, readiness, and persistence; verify readiness and manual CRUD tests.
- [ ] 3.3 Coordinate with `sqlite-duckdb-storage-migration` so its fresh SQLite schema omits all removed fields and never ports the Graph as Code repository; verify fresh-schema and repository integration tests.

## 4. Integration checks

- [ ] 4.1 Run `vp check`, `vp test`, `vp run build`, and `openspec validate remove-graph-code-and-postman-imports --strict`; verify Graph as Code and Postman import references are gone from active code while OpenAPI and `.proto` inputs still work.
