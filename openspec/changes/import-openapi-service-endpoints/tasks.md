# Tasks

## 1. Parser and endpoint mapping

- [x] 1.1 Add `@scalar/openapi-parser` and verify the dependency installs and is available to the Nuxt client bundle.
- [x] 1.2 Implement an isolated OpenAPI import utility that parses and validates uploaded JSON/YAML, maps supported operations into endpoint drafts, skips duplicates and unsupported methods with per-operation warnings, and leaves the input unchanged on parse failure; add unit tests for JSON, YAML, name fallback, methods, duplicate normalization, and invalid documents.

## 2. Service settings integration

- [x] 2.1 Add an OpenAPI upload control to service settings and connect it to the import utility; add component tests for file selection, accepted draft additions, duplicate/unsupported warnings, and parser errors.
- [x] 2.2 Verify imported endpoints remain draft-only until Save, replace only the untouched starter row on new services, persist through the existing service create/update flow, and are discarded with Discard; add view-model or integration tests for add, edit, save, and discard flows.

## 3. Integration verification

- [x] 3.1 Run focused tests for the parser utility and service settings, then run `vp check` and strict OpenSpec validation; confirm existing service endpoint editing and mock API connections still work.
