# Tasks

## 1. Module boundaries

- [ ] 1.1 Inventory server tables, repository calls, route contracts, and cross-domain imports; verify a responsibility and public owner is recorded for each table and operation.
- [ ] 1.2 Establish server module folders and explicit public entries without changing route behavior; verify imports with `vp check` and current focused use-case tests.

## 2. Service registry and graph

- [ ] 2.1 Move service and graph persistence into focused repository classes, one class per file, with injected Drizzle database/transaction; move tests into module `_test_` paths and verify service and canvas use-case tests.
- [ ] 2.2 Make service create/update/delete use cases coordinate service, graph position, and mock API readiness operations in one transaction; verify project isolation and rollback with focused MySQL integration tests.
- [ ] 2.3 Preserve proto-file compensation and route responses through the service migration; verify service HTTP contract and failure-path tests.

## 3. Remaining domain modules

- [ ] 3.1 Move message-destination persistence and health rules into focused classes and module public operations; move tests into `_test_` and verify health and graph integration behavior.
- [ ] 3.2 Move mock API, template, environment-variable, and readiness operations into owning focused classes; remove direct cross-module repository imports and verify readiness plus CRUD tests.
- [ ] 3.3 Move observability, runs, and access/project operations into owned modules without changing OTLP or login contracts; move tests into `_test_` and verify route and use-case tests.

## 4. Integration checks

- [ ] 4.1 Run relevant unit and disposable-MySQL integration tests, `vp check`, `vp run build`, and `openspec validate backend-modular-monolith --strict`; verify route payloads, `PROJECT_ID` isolation, and transaction rollback remain correct.
