# Design

## Context

See `proposal.md` for motivation and `specs/service-graph/spec.md` for the user-visible contract. The service settings view model already keeps endpoint edits in a draft and sends them through the existing service create/update API when the user saves. Endpoint records use a REST type, one of five supported methods, and a URL path; mock APIs and service edges refer to endpoint IDs.

## Goals / Non-Goals

**Goals:**

- Reuse the current service draft and persistence flow for imported endpoints.
- Keep OpenAPI parsing and endpoint mapping independently testable.
- Preserve existing endpoint IDs and their graph references when imports are applied.

**Non-Goals:**

- Import request bodies, response schemas, parameters, authentication, or server URLs.
- Fetch or resolve remote references or load a schema from a URL.
- Change endpoint methods supported by Cairn or alter the service API contract.

## Decisions

### Parse uploaded JSON and YAML with Scalar

Add `@scalar/openapi-parser` and pass the uploaded file contents to its parsing and validation API. Keep this in a focused frontend utility so the service settings component only emits the selected file and renders import feedback. Do not enable remote reference fetching: import only needs local path and operation metadata, and uploaded documents are not a request to access referenced URLs.

**Alternative considered:** Add a YAML parser and handwritten OpenAPI traversal. Rejected because this duplicates format and schema handling and is more likely to mishandle valid OpenAPI variants.

### Map supported operations into endpoint drafts

Traverse document paths and their HTTP operations. Include only GET, POST, PUT, PATCH, and DELETE. Convert operation methods to uppercase, set `apiType` to `REST`, use the path as the endpoint URL, and choose the name in this order: non-empty `summary`, non-empty `operationId`, then method plus path. Ignore `servers`; the service's configured base URL remains authoritative.

Do not include an imported endpoint's `id`; new entries are draft records and receive IDs through the existing persistence flow. Existing endpoint drafts retain their IDs.

### Skip duplicates and unsupported methods with per-operation warnings

Build duplicate keys from uppercase method and normalized path, and check both endpoints already in the service draft and operations accepted earlier in the same import. Normalize path comparison by ensuring a leading slash and removing trailing slashes except for `/`; preserve path case and parameter names. A duplicate is skipped rather than merged so its existing name and endpoint ID remain intact.

Show one warning toast per skipped duplicate or unsupported operation. Successful operations from the same document still enter the draft. If the parser rejects the document, show an error and make no endpoint draft changes.

### Keep persistence on the existing Save action

The import action appends accepted endpoint drafts to the current service settings draft. It does not send a separate API request. The existing Save action persists all endpoints together, while Discard continues to discard unsaved imports.

**Alternative considered:** Persist imported endpoints immediately. Rejected because it would bypass the established service edit/save flow and make import failures or cancellation harder to reason about.

When a new service draft's original endpoint is still the untouched blank `GET /` starter row, remove that row only if the import accepts at least one operation. Track the original draft row so other blank-looking endpoint rows and any edited starter row are preserved.

## Risks / Trade-offs

- **Parser behavior can vary by OpenAPI version** -> Rely on Scalar's parse/validation result and test representative JSON, YAML, and invalid documents.
- **A document can contain many skipped operations** -> Keep each warning tied to the affected operation and make successful imports independent of skipped entries.
- **Path normalization could conflate routes if applied too broadly** -> Normalize only the leading/trailing slash form; preserve case and parameter spelling.
- **Bundling the parser may add client weight** -> Import only the parser API needed for validation and extraction; do not add a separate UI library.

## Migration Plan

No database migration or API change is required. Add the parser dependency, implement and test the import utility, connect it to service settings, and use the existing service Save flow. Rollback consists of removing the import control and utility; manually registered endpoints remain unchanged.
