# Tasks

## 1. Dependencies and persistence model

- [x] 1.1 Add `@grpc/proto-loader`, `@grpc/grpc-js`, Unstorage filesystem/S3 drivers, and S3 signing dependency; verify package installation and server imports.
- [x] 1.2 Update Drizzle models and migration: move API type to services, add TLS and proto storage key, add mock API type with REST defaults, and represent REST or RPC endpoint fields; verify migration preserves existing REST service, endpoint, mock API, and graph IDs.
- [x] 1.3 Add runtime-configured proto storage for filesystem and S3; configure Docker named volume and env variables; verify local file survives app container replacement and S3 driver reads/writes a test object.
- [x] 1.4 Add optional Docker CA download init service with URL and SHA-256 verification; verify app waits for success and checksum/download failures prevent startup.

## 2. Service API types and proto import

- [x] 2.1 Update service and endpoint API schemas, validation, repositories, and APIs for service-level REST/gRPC types; verify existing REST service create, edit, and list flows remain valid.
- [x] 2.2 Add proto parser that accepts one self-contained file, extracts unary methods, skips streaming methods, reports unresolved imports, and preserves drafts on parse failure; verify parser tests cover valid methods, streaming, duplicates, imports, and invalid syntax.
- [x] 2.3 Update service settings with API type selection, conditional OpenAPI/proto controls, gRPC target address, and TLS checkbox; verify component tests cover both API types and draft save/discard behavior.
- [ ] 2.4 Persist proto files and storage keys when saving services; preserve existing endpoints and connections when importing updated schemas; verify service API and repository tests cover save, reload, replacement, and deletion.

## 3. Graph and HTTP import compatibility

- [x] 3.1 Update canvas APIs, graph data, nodes, and graph-as-code schemas for service-level types and gRPC method names; verify REST and gRPC endpoints render with protocol-appropriate labels.
- [x] 3.2 Update Postman collection matching to use service-level REST type; verify HTTP requests still match only REST endpoints and imports never create gRPC mock APIs.

## 4. gRPC mock API configuration and execution

- [x] 4.1 Add explicit HTTP/gRPC mock API types, persist REST defaults, and filter target endpoints by matching type; verify API and panel tests reject cross-type targets.
- [ ] 4.2 Add unary gRPC execution using the selected service's stored proto, JSON payload validation, target/TLS settings, and `traceparent` metadata; verify successful calls, invalid payloads, timeout, connection failure, and non-OK gRPC status.
- [ ] 4.3 Integrate gRPC responses and status with existing run history, logs, and UI; verify response display, failure state, and trace-linked history.

## 5. Documentation and integration validation

- [x] 5.1 Document service API types, proto upload limits, storage environment variables, TLS roots, and Docker CA download configuration; verify examples match Compose configuration.
- [ ] 5.2 Run focused service, storage, Postman, gRPC mock API, and migration tests; then run `vp check` on changed paths and `openspec validate grpc-api-support --strict`.
