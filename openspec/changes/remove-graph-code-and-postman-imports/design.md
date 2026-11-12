# Design

## Context

See `proposal.md`. Graph as Code spans the toolbar, drawer, manifest schema and serializer, API route, repository, tests, and generated `codeKey` values. The normal canvas still carries and checks those keys, although entity IDs already identify services, endpoints, destinations, and connections. Postman collection and environment import live in the Mock APIs panel and view model. Collection import can copy enabled request headers; it does not import Postman authorization. Unmatched imports have retry and warning logic, and mock API rows contain three import-only fields.

## Goals / Non-Goals

**Goals:** Remove the complete feature paths, simplify contracts and the fresh SQLite schema, and retain all in-app creation and editing flows.

**Non-Goals:** Remove OpenAPI endpoint import, `.proto` upload, normal YAML/JSON request editing, or historical completed OpenSpec changes; redesign graph IDs or existing mock API editor behavior.

## Decisions

### Remove Graph as Code at its entry and ownership points

Remove its toolbar action, drawer state, panel, editor completion, manifest schema/serializer, API client method, route, repository, sample manifest, and feature-specific tests. Remove `codeKey` from service, endpoint, destination, canvas, and message-flow contracts and from their persistence models. Normal canvas validation uses entity IDs for duplicate destination checks; relationships continue to use existing IDs. Remove Graph as Code key parsing from mock API descriptions without changing ordinary user descriptions.

Alternative: hide the button but retain the endpoint and parser. Rejected because maintenance and API surface remain. Alternative: retain `codeKey` as a separate identity. Rejected because ordinary app creation generates random keys and existing IDs already serve that role.

### Remove both Postman import paths without altering manual editors

Remove collection and environment file controls, the two parsers, import handlers, unmatched draft retry watcher, import warnings, and related tests. Keep manual mock API, custom header, shared variable, header template, and authorization template flows. Remove `importMethod`, `importUrl`, and `matchUrl` from mock API drafts, API/canvas contracts, readiness evaluation, and persistence. Existing readiness checks for selected endpoints, headers, variables, and authorization remain; only imported URL fallback logic disappears. No Postman authorization import exists to remove.

Alternative: retain Postman parsing as an internal utility. Rejected because it has no consumer after removing the UI. Alternative: remove shared variables or templates. Rejected because they are core manual settings and remain used by mock APIs and health checks.

### Coordinate the fresh schema with the storage change

Implement this removal with or after `sqlite-duckdb-storage-migration`, but define the new SQLite schema without `codeKey` or Postman import columns. Because the planned database starts empty, no MySQL column migration or data backfill is required. Do not migrate the now-deleted Graph as Code repository to SQLite. Update the pending backend modular monolith plan after both changes are settled so it does not assign a module to removed code.

Alternative: first drop columns from MySQL, then drop them again in SQLite. Rejected as duplicate migration work for data the user has agreed to discard.

## Risks / Trade-offs

- Removing import code can accidentally remove manual variable/header behavior -> keep tests for manual create, update, discard, delete, and save flows.
- `codeKey` is present in many test fixtures and contracts -> update normal graph/canvas tests to assert ID-based behavior and remove feature-only tests.
- Removing the route is a breaking API change -> verify the old endpoint no longer applies a manifest.
- The SQLite migration and this change touch the same schema/contracts -> coordinate their implementation order and validate the combined result before backend modernization.
- OpenAPI parsing may share a dependency with Graph as Code -> remove a package only after checking for remaining imports.

## Migration Plan

1. Inventory all Graph as Code and Postman import references and distinguish shared editors and parsers that must remain.
2. Remove the UI entry points and view-model handlers; verify manual graph and Mock APIs settings behavior.
3. Remove Graph as Code and Postman API/utility paths; verify the old endpoint no longer changes the graph.
4. Remove import-only fields from contracts, validation, readiness, and the fresh SQLite schema; switch destination duplicate checks to IDs and verify canvas/repository tests.
5. Remove feature-only tests and documentation, retain tests for supported manual flows, OpenAPI import, and `.proto` upload; run `vp check`, `vp test`, `vp run build`, and strict OpenSpec validation.
