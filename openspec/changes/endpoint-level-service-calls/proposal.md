# Proposal

## Why

Declared service calls currently identify only the source service and target endpoint, so the graph cannot show which endpoint initiates each call. Endpoint-level relationships will make service dependencies clearer and support precise editing without treating every registered API as a caller.

## What Changes

- Associate each declared outbound call with a source endpoint and a target endpoint.
- Show endpoint-specific inbound and outbound connections on service nodes, with endpoint rows available when expanded and connections visually bundled when collapsed.
- Add outbound connection controls to each endpoint's service settings card, including target selection and confirmed deletion.
- Keep OpenAPI import limited to endpoint definitions; users create call relationships explicitly.
- Preserve the identity of each relationship when rendering or collapsing graph connections.

## Capabilities

### New Capabilities

- `service-call-graph`: Define, edit, and visualize endpoint-level service call relationships.

### Modified Capabilities

None. The repository has no durable OpenSpec capabilities yet; the completed `service-graph-editor` change contains historical requirements but is not in `openspec/specs/`.

## Impact

- Graph edge contracts, persistence, validation, and canvas save/load behavior.
- Vue Flow service nodes, connection interactions, and service endpoint settings.
- OpenAPI import behavior remains endpoint-only and must not create call relationships.
