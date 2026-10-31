# Proposal

## Why

Registering a service with many endpoints requires entering each endpoint by hand. Importing operations from an OpenAPI document makes service setup faster and less error-prone while retaining the service's existing base URL and graph connections.

## What Changes

- Allow users to upload an OpenAPI schema in JSON or YAML from service settings.
- Parse and validate the uploaded document with `@scalar/openapi-parser` and add supported operations to the service endpoint draft.
- Remove the untouched blank starter endpoint when importing at least one operation into a new service draft.
- Treat imported operations as REST endpoints, derive their names from operation metadata, and warn when operations are skipped because of duplicates or unsupported HTTP methods.

## Capabilities

### New Capabilities

- `service-graph`: Register service endpoints manually or from an OpenAPI document.

### Modified Capabilities

None.

## Impact

- Service settings UI and service endpoint draft handling.
- Frontend OpenAPI parsing and endpoint extraction, using `@scalar/openapi-parser`.
- Unit and component tests for document parsing, endpoint mapping, duplicate detection, and import feedback.
