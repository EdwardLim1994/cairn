# Proposal

## Why

Cairn currently models REST endpoints as individual HTTP operations. GraphQL services expose one endpoint for many queries and mutations, so users need a service type and mock request model that represent this shape directly.

## What Changes

- Add GraphQL as a service-level API type with one registered endpoint for the GraphQL server URL.
- Let users explicitly create GraphQL mock APIs that target a registered GraphQL endpoint and contain a GraphQL operation with JSON variables.
- Use CodeMirror GraphQL language support for syntax validation and a JSON editor for variables.
- Keep Postman collection import HTTP-only; users create GraphQL mock APIs directly.
- Defer GraphQL schema introspection, schema upload, and schema-aware autocomplete or validation.

## Capabilities

### New Capabilities

- `graphql-service-endpoints`: Register GraphQL services as one endpoint on the service node.
- `graphql-mock-apis`: Create and run explicit GraphQL requests against registered GraphQL services.

### Modified Capabilities

None. This project has no main specs; these behaviors are new capabilities.

## Impact

Service and endpoint schemas, service settings UI, mock API settings and execution, request persistence, run results, and CodeMirror configuration. Add CodeMirror GraphQL language support. Postman collection import remains HTTP-only.
