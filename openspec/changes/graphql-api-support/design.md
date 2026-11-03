# Design

## Context

Service API type currently lives on each endpoint, and service endpoints store HTTP method and URL. Mock API requests use a JSON body and execute through the existing HTTP run flow. The request editor currently provides JSON editing and linting.

See proposal.md for motivation. The GraphQL service and mock API capabilities define user-visible behavior.

## Goals / Non-Goals

**Goals:**

- Represent each GraphQL service with one registered GraphQL endpoint.
- Create GraphQL mock APIs explicitly and constrain them to GraphQL endpoints.
- Use the existing HTTP execution and run history paths for GraphQL request/response calls.
- Validate GraphQL syntax without loading a service schema.

**Non-Goals:**

- GraphQL schema introspection, upload, field validation, or schema-aware autocomplete.
- Postman GraphQL or mixed-protocol collection import.
- GraphQL subscriptions or other multi-response transports.

## Decisions

### Keep API type on the service

Add `apiType` to the service and default existing services to REST. Use values REST and GRAPHQL in this change. Remove endpoint-level `apiType` after migrating current endpoint values to their owning service. Keep the service type field extensible so later API types can be added without moving the field again.

REST endpoints retain their method and URL. A GraphQL service has exactly one endpoint, with a fixed POST method and a configured URL path under the service base URL. Service validation rejects zero or multiple GraphQL endpoints. The service editor hides OpenAPI import and endpoint add/remove controls for GraphQL.

### Persist GraphQL mock type and request

Add a mock API `apiType`, defaulting existing records and Postman imports to REST. Provide separate REST and GraphQL creation actions, and validate that a mock API target belongs to a service of the same type.

Store a GraphQL request in the existing request JSON field as `{ query, variables, operationName? }`. Use a GraphQL query editor and the existing JSON editor for variables. The GraphQL editor uses the GraphiQL project's `cm6-graphql` CodeMirror 6 extension without a schema. This gives syntax validation only; do not introspect or persist a GraphQL schema.

### Execute GraphQL over the existing HTTP path

Send GraphQL query and mutation requests as HTTP POST to the service's single endpoint, with a JSON body and `application/json` content type. Reuse existing outbound URL resolution, shared variables, authorization, custom headers, timeouts, traceparent propagation, run history, and response display. Keep Postman imports restricted to REST endpoints.

Treat network failures and non-success HTTP status codes as failed runs under existing HTTP behavior. For successful HTTP responses, preserve the complete GraphQL response JSON, including any `errors` array, and show it to the user. GraphQL errors in an HTTP success response do not change the transport run to failed.

### Preserve existing REST behavior

Set migrated services and mock APIs to REST. Keep Postman collection drafts REST-only. Keep REST method, URL, path parameter, and request body behavior unchanged while graph APIs and editors branch on the owning service or mock API type.

## Risks / Trade-offs

- Syntax validation without a schema cannot detect unknown fields, arguments, or types. Add schema-aware features only when users need them.
- A service has one GraphQL endpoint, so graph edges represent the server endpoint rather than individual queries or mutations.
- GraphQL can return partial data with an `errors` array and HTTP 200. Preserve the response and distinguish GraphQL errors from transport failure.
- Moving API type from endpoints to services touches graph data, API validation, and graph-as-code formats. Migrate existing endpoint values before removing the old column.

## Migration Plan

1. Add service `apiType` and mock API `apiType` with REST defaults. Backfill both from current behavior before removing endpoint `apiType`.
2. Preserve existing endpoint IDs and REST method/URL fields. Add validation for one POST GraphQL endpoint per GraphQL service.
3. Deploy code and migration together. Roll back using the previous image and a database backup if the endpoint type migration must be reversed.
