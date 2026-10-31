# Tasks

## 1. Nuxt UI adoption

- [x] 1.1 Confirm Nuxt UI compatibility with the installed Nuxt 4 and Tailwind CSS v4 versions, then add and configure the compatible package; verify Nuxt starts and production build resolves the module.
- [x] 1.2 Migrate generic button, input, select, and form controls in one cohesive settings surface to Nuxt UI; add/update component tests and verify validation, saving, focus, and dark-mode behavior.
- [x] 1.3 Migrate generic accordion, menu, and notification primitives to Nuxt UI where supported; add/update component tests and verify expand/collapse, outside-click, keyboard, and toast behavior.
- [x] 1.4 Remove replaced custom generic primitives only after all usages migrate; verify no stale imports/usages remain and all affected component tests pass.
- [x] 1.5 Document the UI component conventions and the boundary for Cairn-specific graph/editor components; verify contributor guidance reflects the final component structure.

## 2. Coverage reporting and CI wiring

- [x] 2.1 Inspect the installed Vite+/Vitest versions and configure a compatible coverage provider that emits `coverage/lcov.info`; verify a local coverage run creates a non-empty LCOV report.
- [x] 2.2 Configure SonarCloud to read the generated LCOV path while preserving current source and test exclusions; verify scanner configuration resolves the report path.
- [x] 2.3 Update GitHub Actions so coverage tests complete and the report is available before SonarCloud analysis, including artifact transfer if jobs remain separate; verify workflow ordering and run the CI-equivalent pipeline when credentials are available.
- [x] 2.4 Document the local coverage command and CI report flow in the README or contributor guidance; verify commands match package scripts and run successfully.

## 3. Sonar issue remediation

- [x] 3.1 Refresh SonarCloud issues and record current status for the seven identified complexity hotspots; verify the implementation list maps to current issue keys and locations.
- [x] 3.2 Refactor `app/utils/openapi-import.ts` and `app/utils/postman-import.ts` complexity hotspots in behavior-preserving steps; add/update parser tests and verify focused import tests pass.
- [x] 3.3 Refactor `app/composables/useMockApiRunViewModel.ts` and `app/composables/useMockApiViewModel.ts` complexity hotspots; add/update view-model tests and verify focused tests pass.
- [x] 3.4 Refactor `server/use-cases/telemetry/ingest-otlp-logs.ts` and `server/use-cases/telemetry/ingest-otlp-traces.ts` complexity hotspots while preserving event ordering; add/update use-case tests and verify telemetry tests pass.
- [x] 3.5 Review recurring sequential-await, nested-conditional, regex, and async-without-await findings in batches; fix safe cases, preserve observable ordering where writes or polling depend on it, add/update tests for ordering/error cases, and verify affected suites pass.
- [x] 3.6 Address recurring accessibility and `!important` findings without changing intended interactions or theme styling; add/update component tests and verify keyboard interaction, focus, and dark-mode states.
- [x] 3.7 Re-query SonarCloud and document resolved, remaining, or obsolete findings with their disposition; verify no addressed finding remains open and remaining issues have a concrete follow-up rationale.

## 4. Integrated quality gate verification

- [x] 4.1 Run `vp check` on changed paths and the complete unit, component, and MySQL integration suites; verify all checks pass.
- [x] 4.2 Run the production build and CI-equivalent coverage generation; verify build succeeds and LCOV represents the current commit.
- [x] 4.3 Run SonarCloud analysis with the generated report, inspect new-code coverage and remaining issue groups, and document the resulting quality gate status; verify the scan used the intended commit and LCOV artifact.
