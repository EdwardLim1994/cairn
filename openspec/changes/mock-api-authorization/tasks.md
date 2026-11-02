# Tasks

## 1. Persist authorization templates

- [ ] 1.1 Add a project-scoped authorization template table and nullable mock API association; generate Drizzle SQL and metadata, then verify the migration upgrades an existing MySQL database and leaves current APIs unassigned.
- [ ] 1.2 Extend shared schemas and the staged settings save transaction for type-discriminated authorization templates and API assignments; verify template ID mapping, project ownership, duplicate-name rejection, and Save/Discard behavior with focused repository tests.

## 2. Add template and per-API authorization UI

- [ ] 2.1 Add the Shareable authorization templates section with New template accordion, type selector, and conditional fields for Bearer, Basic, API key, and OAuth Client Credentials; verify component tests cover each type's visible fields and template editing.
- [ ] 2.2 Add the per-API Authorization accordion with No Auth and saved-template selection, plus masked secret inputs and show/hide control; verify panel tests cover assignment, no-auth selection, secret masking, and Save/Discard.

## 3. Resolve static authorization and conflicts

- [ ] 3.1 Generate Bearer, Basic, and API-key request headers on the server using resolved project variables; verify unit tests cover header formats, variable resolution, and API-key header names.
- [ ] 3.2 Extend shared readiness and run preflight to reject case-insensitive collisions between generated authorization headers and raw header templates/custom headers; verify readiness and run tests prove conflicts prevent outbound requests without exposing values.

## 4. Implement OAuth Client Credentials

- [ ] 4.1 Add a server-side OAuth token client using form-encoded Client Credentials and `client_secret_basic`; verify tests assert token URL, client credentials, optional scope, timeout behavior, and redacted failures.
- [ ] 4.2 Cache tokens by project/template/configuration until shortly before `expires_in`, coalesce concurrent acquisition, and avoid caching responses without usable expiry; verify cache reuse, refresh, configuration invalidation, and concurrent request tests.
- [ ] 4.3 Use acquired OAuth tokens for target requests and fail runs before target execution when acquisition fails; verify integration-style use-case tests assert the target fetch is skipped and no credential value is logged.

## 5. Document behavior and verify the integrated change

- [ ] 5.1 Update operator documentation for authorization templates, supported methods, OAuth Client Credentials fields and limits, header conflict behavior, secret storage assumptions, and the deferred Postman auth import; verify the documented UI labels and behavior match the implementation.
- [ ] 5.2 Run focused repository, readiness, run-use-case, panel component, and import regression tests; confirm existing APIs without authorization templates and current Postman unsupported-auth warnings still behave as specified.
- [ ] 5.3 Run `vp check` on changed source files and `openspec validate mock-api-authorization --strict`; resolve failures before implementation is considered ready.
