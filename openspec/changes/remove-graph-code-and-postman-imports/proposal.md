# Proposal

## Why

Graph as Code and Postman imports duplicate Cairn Personal's in-app configuration flows and add parsing, matching, retry, schema, and UI paths to maintain. The user wants configuration to happen in the app while retaining the distinct OpenAPI and `.proto` inputs for service setup.

## What Changes

- **BREAKING** Remove the Graph as Code toolbar action, panel, graph manifest parser/serializer, and `/api/graph-code` endpoint.
- Remove Postman collection import for mock API drafts and request headers, and Postman environment import for shared variables. Remove their controls, parsers, unmatched-request retry, and import warning behavior.
- Remove Graph as Code's `codeKey` fields from services, endpoints, and message destinations, and Postman-only `importMethod`, `importUrl`, and `matchUrl` fields from mock APIs and contracts. Use existing record IDs for ordinary canvas references and duplicate checks.
- Keep manual creation and editing of services, endpoints, graph connections, message destinations, mock APIs, headers, variables, and authorization templates. Keep OpenAPI endpoint import and `.proto` upload.
- Coordinate field removal with the fresh SQLite schema planned in `sqlite-duckdb-storage-migration`; no legacy MySQL data transfer is required.

## Capabilities

### New Capabilities

- `configuration-sources`: Defines supported ways to configure the workspace and the removed import surfaces.

### Modified Capabilities

None. The project has no durable capability specs yet.

## Impact

- Toolbar and settings panels, page and composable state, API client and route, graph and Postman utility code, readiness logic, shared contracts, database schema, sample manifests, documentation, and tests.
- The pending SQLite migration must omit import-only fields; the pending backend and frontend modularization plans must not carry removed Graph as Code or Postman paths forward.
