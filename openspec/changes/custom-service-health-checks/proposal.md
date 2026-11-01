# Proposal

## Why

Cairn currently recognizes only Spring Boot and .NET health endpoints. Services using other frameworks are always shown as offline even when they are healthy. Let users configure a GET health-check URL and headers so custom services can report their actual health.

## What Changes

- Add an `Other` framework option to service registration and editing.
- When `Other` is selected, show a health-check URL field and header configuration using the existing shared header-template and custom-header behavior.
- Restrict custom health checks to GET and show that restriction as guidance beside the URL field.
- Use the first two characters of the service name as the graph icon for `Other` services.
- Persist and execute custom health-check configuration while retaining the built-in Spring Boot and .NET checks.

## Capabilities

### New Capabilities

- `service-graph`: Register services with an `Other` framework choice and display a service-name initials icon for it.
- `service-health-checks`: Configure and execute GET health checks for services using a custom URL and optional shared or custom headers.

### Modified Capabilities

None. The project has no durable specs under `openspec/specs` yet.

## Impact

- Service settings form and graph-node framework icon rendering.
- Service API schemas, validation, CRUD persistence, health-target queries, and health-check execution.
- Drizzle service schema and a migration for the custom URL and header configuration.
- Header-template deletion behavior so references from service health checks are handled safely.
- Service and health-check tests; no new dependencies expected.
