# Tasks

## 1. Test inventory

- [ ] 1.1 After frontend and backend module migrations, list remaining tests outside owning `_test_` directories and map each to a module path; verify every production test has one destination.
- [ ] 1.2 Record unit/component and integration test discovery counts before relocation; verify the existing `test:unit` and `test:integration` commands select their intended tiers.

## 2. Relocate remaining tests

- [ ] 2.1 Move remaining frontend and shared tests into one mirrored `_test_` directory per module; update imports and verify each moved group with focused `vp test run`.
- [ ] 2.2 Move remaining backend unit, route, and integration tests into owning module `_test_` paths; update imports and verify focused unit and MySQL integration groups.
- [ ] 2.3 Remove old test copies and adjust discovery or coverage paths only where relocation requires it; verify counts match the inventory and no test is selected twice or missed.

## 3. Integration checks

- [ ] 3.1 Run `vp check`, `vp run test:unit`, and `vp run test:integration` with disposable MySQL, then validate `test-layout-consolidation` with `openspec validate --strict`; verify CI test tiers remain green.
