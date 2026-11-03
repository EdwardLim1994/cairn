# Design

## Context

Services currently have no API type; each endpoint stores `apiType`, HTTP method, and URL. Service validation, graph data, OpenAPI import, Postman matching, and REST mock execution assume REST. The app uses MySQL and Docker Compose. Nitro 2.13.5 provides a storage layer; Unstorage supports filesystem and S3-compatible drivers.

See proposal.md for motivation and the spec deltas for user-visible behavior.

## Goals / Non-Goals

**Goals:**

- Preserve existing REST services and mock API behavior while moving API type to the service.
- Load unary gRPC methods and request/response types dynamically from each service's proto file.
- Reuse existing mock API run, response, history, and trace correlation flows.
- Keep proto storage persistent in Docker and configurable for S3-compatible object storage.

**Non-Goals:**

- Streaming RPCs, server-sent events, or Postman gRPC collection import.
- Proto dependency file upload or remote imports.
- Generated client code or user-uploaded client certificates for mutual TLS.

## Decisions

### Service-level API type and endpoint shape

Add `apiType` to services with `REST` default. Migrate existing services to REST, then remove endpoint-level `apiType`. REST endpoints retain method and URL. gRPC endpoints store fully qualified RPC method names; REST-only method and URL fields become nullable or are replaced with a type-specific endpoint shape. Update shared API schemas, graph-code formats, canvas data, validation, and import matching to read type from the owning service.

Keep the existing service address field in persisted/API data to limit unrelated renames. Label it as Base URL for REST and Target address for gRPC. Validate gRPC target as `host:port`; pass target directly to the gRPC client. Rewrite host `localhost` through the existing Docker host-gateway setting while preserving port.

### Runtime proto loading

Use `@grpc/proto-loader` to parse the uploaded self-contained proto file and enumerate service methods. Add only unary methods; report streaming methods as unsupported. Store each endpoint's fully qualified RPC name. Do not store duplicate request/response descriptors; derive them from the stored proto when validating a JSON payload and building the gRPC client.

At call time, retrieve the proto source from configured storage, materialize it in a private temporary directory, load it with `@grpc/proto-loader`, construct the service client with `@grpc/grpc-js`, and invoke the selected unary method. Remove temporary files and close the client on completion or failure. Start without a process-wide descriptor cache; add caching only if repeated parsing is measurably expensive.

### Proto storage

Store file contents through one server-side storage adapter. Keep only the storage key on the service row. Use Nitro storage/Unstorage drivers: filesystem by default and S3-compatible storage when selected by runtime environment variables. Because runtime storage configuration must remain environment-driven in the deployed image, initialize the adapter from runtime configuration rather than baking provider credentials into the build.

For local Docker storage, mount a named volume at a fixed app data path. For S3, configure endpoint, region, bucket, access key, and secret key through environment variables. Use versioned object keys when replacing a schema: write the new object, save its key with the service transaction, then remove the previous object. This avoids leaving a service row pointing at a partially replaced file. Remove the stored object after service deletion.

### TLS and custom CA roots

Persist a TLS boolean per gRPC service. Use `createSsl()` when enabled and `createInsecure()` otherwise. Rely on gRPC's default trusted roots when no custom root bundle is configured. For a private CA, set `GRPC_DEFAULT_SSL_ROOTS_FILE_PATH` to a mounted PEM bundle.

For Docker Compose deployments that configure a CA URL, use a one-shot init service and a shared named volume. Require an expected SHA-256 checksum, verify the downloaded PEM, and make the app depend on successful completion. Skip download when no CA URL is configured. Do not fetch a CA from inside normal request handling.

### Mock API and trace integration

Add an API type to mock APIs, defaulting existing rows and Postman imports to REST. Provide explicit HTTP and gRPC creation actions. Filter target endpoints to services of the same type and reject mismatched targets at the API boundary. Keep the existing JSON editor and persist request messages in the existing request JSON field. Validate against the request type from the service proto before a call.

Keep Postman import on the REST matching path. For gRPC, create a run using the existing run identifier and trace ID, and attach `traceparent` as gRPC metadata. Persist response JSON, gRPC status, and error details in the existing run/history result model, with a narrow result-schema extension if status cannot fit existing HTTP status fields.

## Risks / Trade-offs

- Object storage and MySQL cannot share a transaction → use versioned keys and delete old objects only after the database update succeeds.
- A proto may be valid but contain no unary methods → reject it with a clear message and leave endpoint drafts unchanged.
- A CA PEM from the wrong source can establish unsafe trust → require a configured SHA-256 checksum for startup downloads; never disable certificate verification.
- A custom roots file can replace the runtime's default root bundle → document that deployments must provide the complete desired CA bundle.
- Host-gateway rewriting can change a target unexpectedly → apply it only to `localhost` and preserve explicit remote hostnames and ports.

## Migration Plan

1. Add service API type, target TLS, and proto storage key fields. Add mock API type with REST default. Set existing services and mock APIs to REST; migrate existing endpoint type values before removing the endpoint-level field.
2. Make endpoint REST fields optional for gRPC and add the qualified RPC method field. Preserve endpoint IDs so existing mock API and graph references remain intact.
3. Deploy local storage volume and optional CA init configuration with the application. S3 deployments set storage environment variables before starting the updated image.
4. Rollback by restoring the previous image and database backup. The migrated schema remains backward-compatible only after restoring the prior database; do not roll back the image alone after dropping endpoint fields.
