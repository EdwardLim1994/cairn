# Design

## Context

See `proposal.md` for motivation and `specs/` for the user-visible contract. Services currently persist their framework and base URL; the health-check use case derives `/actuator/health` for Spring Boot, `/health` for .NET, and marks other framework values offline. Mock APIs already support project-wide header templates, service-specific custom headers, environment-variable references, and common validation/resolution helpers.

## Goals / Non-Goals

**Goals:**

- Persist the custom health-check URL and header configuration with each service.
- Run the custom check through Cairn's existing outbound URL and header-resolution paths.
- Keep built-in framework checks and graph behavior intact.

**Non-Goals:**

- Configure methods other than GET or send health-check request bodies.
- Add per-health-check timeout controls, retry policy, or response-body matching.
- Add a custom framework-name field or custom framework icon asset.

## Decisions

### Persist URL and headers on the service

Add nullable `healthCheckUrl` and `healthCheckHeaderTemplateId` fields plus a non-null `healthCheckCustomHeaders` JSON array on the service record. Extend service input and response contracts so create, update, service listing, and canvas loading round-trip those values. Existing rows receive null URL/template and an empty custom-header array, preserving the current data and default health-check behavior.

The selected template remains the existing project-wide header template. Service custom headers use the same merge rule as mock APIs: values with the same case-insensitive header name override the template. Template lookup must be scoped to the current project. Deleting a template detaches both mock API and service references while leaving custom headers intact.

### Configure the custom check only for Other

Add `Other` to the framework selector. Selecting it reveals a URL field and the existing header-template/custom-header controls. The URL accepts an HTTP(S) absolute URL or a relative path resolved against the service base URL. A nearby tip states that only GET is allowed. When switching from `Other` to Spring Boot or .NET, retain the custom values but ignore them while the built-in framework probe is active; switching back restores the values.

For an `Other` service without a health-check URL, report Offline rather than inventing a path. Keep the framework label as `Other`; do not add a separate framework-name input. Its graph icon uses the first two characters of the service name.

### Reuse existing health and header execution paths

Extend the health-target repository result with the saved custom URL, template headers, and custom header rows. Load the project's environment variables for the check and resolve headers using the existing shared `resolveHeaderRows` helper. This keeps validation, variable expansion, case-insensitive merging, and reserved-header handling consistent with mock API calls.

For `Other`, send a GET to `getOutboundUrl(healthCheckUrl, baseUrl)` with resolved headers and the existing health-check timeout. Treat a 2xx response as Online; missing configuration, unresolved variables, network errors, timeouts, and non-2xx responses are Offline. Keep the current Spring Boot and .NET URL selection unchanged.

### Apply the database change additively

Add the nullable URL and template-reference columns and a JSON custom-header column with an empty-array default through a Drizzle migration. The template reference uses `ON DELETE SET NULL`; the explicit template deletion flow also clears service references before deleting the template, matching existing mock API behavior.

## Risks / Trade-offs

- An absolute health-check URL can target a different host than the registered service base URL → accept only HTTP(S), reject embedded credentials, and pass the URL through the existing outbound URL helper; broader outbound-host restrictions remain a separate deployment concern.
- A deleted header template may have contained required authentication → detach the reference, preserve service custom headers, and let the next check report Offline until a valid template is selected.
- A missing environment-variable reference makes a probe fail → reuse existing resolution errors and report the service Offline without sending a partially configured request.

## Migration Plan

1. Add the service columns and migration metadata without rewriting existing service rows.
2. Deploy the app with contracts and health-check behavior that default missing fields to no custom URL and empty headers.
3. Existing Spring Boot and .NET services continue using their current health paths; users can configure `Other` services after deployment.
4. Roll back by reverting the app image. Keep the additive columns; they are nullable/defaulted and do not prevent the previous app version from reading existing service data.
