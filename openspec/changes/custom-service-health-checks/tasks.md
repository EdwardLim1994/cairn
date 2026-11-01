# Tasks

## 1. Persist service health-check configuration

- [x] 1.1 Add nullable health-check URL and header-template fields plus a default-empty custom-header JSON field to the service schema; generate and review an additive Drizzle migration with `vp run db:generate`.
- [x] 1.2 Extend service input, list, and canvas contracts and validation to round-trip the health-check fields; verify with focused API and contract tests.
- [x] 1.3 Persist health-check configuration on service create/update, validate selected templates belong to the project, and clear service references when a template is deleted; verify with repository integration tests.

## 2. Configure custom services in the panel

- [x] 2.1 Add the `Other` framework option and conditionally show the health-check URL, reusable header-template/custom-header controls, and GET-only tip; verify with ServiceSettingsPanel component tests.
- [x] 2.2 Carry health-check values through service create, edit, save, and discard flows, and display the first two service-name characters for Other graph nodes; verify with service view-model and graph-node tests.

## 3. Run custom health checks

- [x] 3.1 Extend health-target loading and health-check execution to GET the configured absolute URL or base-URL-relative path with resolved template/custom headers and shared variables; retain Spring Boot and .NET defaults and verify with focused use-case tests.
- [x] 3.2 Cover successful and unsuccessful custom responses, missing URLs, missing variables, timeouts, project-scoped template references, and unchanged built-in probes; verify with focused service API integration tests.
- [x] 3.3 Run `vp check` and the focused service, panel, and migration tests; verify the change with `openspec validate custom-service-health-checks --strict`.
