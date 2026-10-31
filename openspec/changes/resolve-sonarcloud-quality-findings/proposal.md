# Proposal

## Why

SonarCloud currently reports 110 open findings on `main`, and the quality gate fails because it sees 0% coverage for new code against an 80% threshold. The project already runs unit, component, and MySQL integration tests, but the scan does not consume their coverage; the same review also identified maintainability and accessibility findings that should be addressed in focused, behavior-preserving batches.

## What Changes

- Replace hand-built generic UI controls with Nuxt UI components where suitable, retaining Cairn-specific graph and CodeMirror components. This migration is the first implementation phase.
- Generate and publish LCOV coverage from the test pipeline, then make SonarCloud scan after coverage is available.
- Refactor the seven critical cognitive-complexity findings and prioritize recurring maintainability and accessibility rules after the UI migration.
- Verify each batch with targeted tests, the full project checks, and a fresh SonarCloud analysis.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change covers CI reporting and internal implementation refactors without changing user-visible behavior, so spec deltas are intentionally skipped.

## Impact

- Frontend generic controls, Nuxt UI configuration, and component tests (first phase).
- GitHub Actions workflows and SonarCloud scanner configuration.
- Vitest/Vite+ coverage configuration and dependencies if required.
- Frontend components, composables, and import utilities; backend OTLP ingestion use cases.
- Existing unit, component, and integration tests.
