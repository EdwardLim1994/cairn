# Tasks

## 1. Test inventory

- [x] 1.1 After frontend and backend module migrations, list remaining tests outside owning `__test__` directories and map each to a module path; verify every production test has one destination.
- [x] 1.2 Record unit/component and integration test discovery counts before relocation; verify the existing `test:unit` and `test:integration` commands select their intended tiers.

## 2. Relocate remaining tests

- [x] 2.1 Move remaining frontend and shared tests into one mirrored `__test__` directory per module; update imports and verify each moved group with focused `vp test run`.
- [x] 2.2 Move remaining backend unit, route, and integration tests into owning module `__test__` paths; update imports and verify focused unit and SQLite/DuckDB integration groups.
- [x] 2.3 Remove old test copies and adjust discovery or coverage paths only where relocation requires it; verify counts match the inventory and no test is selected twice or missed.

## 3. Integration checks

- [x] 3.1 Run `vp check`, `vp run test:unit`, and `vp run test:integration` with disposable SQLite and DuckDB data, then validate `test-layout-consolidation` with `openspec validate --strict`; verify CI test tiers remain green.
