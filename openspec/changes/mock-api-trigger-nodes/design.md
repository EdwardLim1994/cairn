# Design

## Context

See [proposal.md](proposal.md) for motivation and scope. The graph currently synthesizes one `mock-apis` node, renders one outgoing edge per configured API, and persists a single position for that node. Mock API execution and trace observations are already handled outside the graph node.

## Goals / Non-Goals

**Goals:**

- Derive one compact trigger node and target edge for every saved mock API.
- Give trigger nodes an automatic initial position beside their target service and persist user-moved positions across graph reloads.
- Preserve existing execution, run result, history, and service trace behavior.

**Non-Goals:**

- Change mock API execution or its HTTP/API contract.
- Change mock API execution behavior.
- Remove the legacy canvas `mockNode` coordinate from storage or API contracts as part of this UI change.

## Decisions

### Derive trigger nodes from mock APIs and service positions

Generate a graph node for each saved mock API with a valid target endpoint. APIs without saved coordinates start beside their owning service, grouped in a deterministic vertical stack ordered by stable API identity. Persist manually moved coordinates with the mock API row through the canvas save contract. Once a position is saved, it remains fixed when the target service moves; newly configured APIs continue to receive an automatic initial position.

Alternative considered: always derive positions from the target service. This prevents users from organizing dense groups around the graph.

### Keep trigger execution in the graph node

Each node shows the full mock API name and an icon-only Trigger button with an accessible label. The button invokes the existing run action, is disabled when the saved mock API is inactive, and reflects the running state to prevent duplicate triggers. The existing result drawer, logs, history, and trace observation remain the surfaces for outcomes.

Highlight the trigger-to-service edge with the existing running-edge style while its mock API is running, but do not animate it. Once the API call completes or fails, animate the edge with the observed-edge style.

Alternative considered: make the node itself clickable to run. A dedicated button provides a clearer accessible action and avoids surprising runs when users select or interact with the node.

### Retain endpoint edges and service trace edges

Each trigger node connects directly to its configured endpoint handle. Remove the shared mock-node edges and mock-node status/highlighting. Continue rendering declared service-to-service edges and animated trace-observed service connections, along with participating service health/error highlighting.

### Preserve the canvas contract during this change

Continue accepting and returning the existing `mockNode` canvas coordinate for compatibility, but do not render or update it. Service positions and viewport remain persisted as today. Persist trigger node coordinates with their mock API records. Removing the unused coordinate from the API and database is a separate cleanup.

## Risks / Trade-offs

- [Many APIs target the same service] → Stack their compact nodes in a stable order with consistent spacing; verify graph bounds and readability with dense groups.
- [Unpositioned nodes can overlap nearby services] → Start new trigger nodes in a consistent lane beside their target service and allow users to adjust the layout.
- [Inactive or not-ready APIs might still appear actionable] → Disable Trigger for inactive APIs and retain existing readiness information in the Mock APIs panel; avoid changing readiness policy in this change.
- [Legacy canvas coordinate becomes unused] → Retain the field in reads/writes for compatibility and document it as non-rendered until a separate migration removes it.

## Migration Plan

Add nullable position columns to mock API rows. Existing rows with no saved position continue to receive derived initial positions. Existing service positions and viewport remain valid, and the legacy mock-node coordinate remains accepted for compatibility.

## Open Questions

None.
