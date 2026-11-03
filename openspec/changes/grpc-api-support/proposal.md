# Proposal

## Why

Cairn currently registers and runs REST endpoints only. Teams with gRPC services need to describe unary methods, prepare mock calls, and inspect outcomes through the same service graph.

## What Changes

- Add service-level REST/gRPC selection. Keep OpenAPI import for REST; let gRPC services upload a `.proto` file and create endpoint drafts from unary methods.
- Persist each service's proto file through configurable local or S3-compatible storage. Mount a local Docker volume by default; allow S3 settings through environment variables.
- Add explicit gRPC mock API creation and unary invocation through `@grpc/grpc-js`, using the selected service's proto schema.
- Keep Postman collection import HTTP-only. Add a per-service TLS option and support custom CA roots through container configuration.

## Capabilities

### New Capabilities

- `grpc-service-endpoints`: Service API type, proto upload, and unary method endpoint registration.
- `grpc-mock-apis`: Explicit gRPC mock API creation, endpoint selection, and unary calls.

### Modified Capabilities

None. This project has no main specs; these behaviors are new capabilities.

## Impact

Service and endpoint schemas, service settings UI, mock API settings and execution, database migration, proto file storage, Docker Compose configuration, and Postman import matching. Add `@grpc/proto-loader` and `@grpc/grpc-js`.
