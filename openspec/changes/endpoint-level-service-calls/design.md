# Design

## Context

See `proposal.md` for motivation and `specs/service-call-graph/spec.md` for user-visible behavior. The current `service_edges` record stores a source service and target endpoint. Vue Flow draws the source from one service-level handle and the target from an endpoint handle. Service settings already group editable endpoints into accordion cards.

## Goals / Non-Goals

**Goals:**

- Give each new declared call a stable source endpoint and target endpoint identity.
- Keep panel edits and graph wires backed by the same saved relationship.
- Preserve older service-level calls until users assign a source endpoint.
- Keep collapsing endpoints as a visual operation.

**Non-Goals:**

- Infer call relationships from OpenAPI operations.
- Change observed OpenTelemetry flows, which remain based on collected spans.
- Add new relationship types or call protocols.

## Decisions

### Store the source endpoint and preserve legacy source service

Add nullable `source_endpoint_id` to `service_edges`. Keep `source_service_id` and `target_endpoint_id`: legacy rows retain their source service and null source endpoint; new rows store both the source service and source endpoint. Validate that both endpoint owners and the target belong to the project, and that the source endpoint belongs to `source_service_id`. Reassigning a legacy wire sets its source endpoint without changing its target.

Replace service-to-target uniqueness for assigned calls with source-endpoint-to-target uniqueness. Preserve legacy calls as unassigned rows; validate their service-to-target identity when saving. This permits two different source endpoints on one service to call the same target endpoint.

### Use endpoint handles for new graph calls

Give every expanded endpoint row a left inbound handle and a right outbound handle. A wire from a source endpoint's right handle to a target endpoint's left handle creates the endpoint pair. When rows are collapsed, place their handles at shared visual connection points while retaining each handle ID and edge identity. Disable wire create, reassign, and delete interactions until rows are expanded.

Keep legacy unassigned wires attached to the service-level source handle. When expanded, users can reconnect a legacy wire's source to an endpoint's outbound handle. After save, the wire uses that endpoint identity. This preserves old intent without guessing which endpoint initiated the call.

### Treat endpoint settings as another editor for the same edges

Add an Outbound calls list to each endpoint accordion card. Each row identifies the target service, method, and endpoint. A dropdown adds a target endpoint; a delete action asks for confirmation. Both operations update the same edge collection used by the graph, so the wire and panel row cannot diverge.

The graph and panel remain separate editing surfaces over one saved relationship model. The panel can manage calls while graph endpoints are collapsed; the expansion restriction applies to wire gestures only.

### Keep OpenAPI import endpoint-only

Leave import mapping focused on operation definitions. Do not add relationship inference based on operation descriptions, paths, or references; endpoint owners create call relationships explicitly through the panel or graph.

## Risks / Trade-offs

- Legacy calls have no recoverable source endpoint → Keep them service-level and let users reassign each wire when endpoint ownership is known.
- Multiple handles share visual positions while collapsed → Disable wire gestures in that state and recalculate node handle positions after expansion or collapse.
- Endpoint ownership can become inconsistent across a request → Validate source service, source endpoint, and target endpoint together before saving the canvas.

## Migration Plan

Add nullable `source_endpoint_id` and an index for assigned endpoint pairs. Existing rows retain `source_service_id` and `target_endpoint_id`, with `source_endpoint_id` left null. Deploy code that renders null-source rows as legacy service-level wires and allows reassignment. Roll back by removing the new column and index; legacy source-service relationships remain intact.

## Open Questions

None.
