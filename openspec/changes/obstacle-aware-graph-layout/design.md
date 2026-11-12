# Design

## Context

See `proposal.md` and `specs/graph-routing/spec.md`. The current `shared/utils/graph-layout.ts` computes node positions from service calls but places all message queues after services. `SquareEdge.vue` independently computes a step path from each edge's handles, so arranged node positions cannot keep connections out of unrelated cards. Vue Flow supports manual dragging, and Auto arrange persists node positions through the canvas API. Edge labels and highlights represent observed telemetry.

## Goals / Non-Goals

**Goals:**

- Use one graph model for node placement and edge routing, including the publisher-to-queue-to-consumer flow.
- Keep obstacle avoidance effective during drag and after node size changes without making Auto arrange automatic.
- Preserve current canvas persistence and telemetry associations.

**Non-Goals:**

- Guarantee zero edge-to-edge crossings for arbitrary manual node positions.
- Persist route bend points or change the canvas API.
- Rearrange node positions automatically on data edits or page load.

## Decisions

### Evaluate ELK layered with orthogonal routing against representative graphs

Build a small read-only layout spike before replacing the custom arranger. Model service calls, publish/subscribe edges, and Mock API targets with actual node sizes and explicit handle ports. Confirm that ELK's returned node positions and edge sections route around cards, preserve handle positions, and perform acceptably on representative graphs. ELK supports orthogonal routing and bend points; these must be rendered rather than recalculated with Vue Flow's generic step path. If the spike does not meet these constraints, retain the existing node arranger and evaluate a separate obstacle-aware orthogonal router. Dagre placement alone is insufficient because it does not make Cairn render obstacle-aware routes.

### Render explicit edge routes in the existing edge component

Keep `SquareEdge.vue` responsible for the path and observed timing UI. Feed it the route's ordered orthogonal points and derive an SVG path from those points. Keep the edge identity, timing details, animation, and handle/dot associations unchanged. Position the timing label on a suitable routed segment, away from node cards where possible. Use the current step-path behavior only as a temporary fallback while a route is being recomputed or if routing fails; report persistent failures during verification rather than silently accepting card intersections.

### Recompute routes from current geometry

Store computed routes in client graph state, keyed by edge ID, but continue to persist only node positions. During node dragging, update affected routes with a bounded lightweight pass so edges follow handles and avoid other cards. On drag stop, run a complete route pass. Recompute after any node size or handle-position change, including expand/collapse and response-panel changes where geometry is affected. Keep position lock and explicit Auto arrange behavior intact. Avoid starting overlapping asynchronous layout results; apply only results for the current graph geometry.

### Optimize node-card clearance before crossings

Treat unrelated node bounds plus a small clearance as routing obstacles. Auto arrange uses declared topology and crossing minimization to choose layer/order, then routes edges orthogonally. Test service cycles, disconnected nodes, multiple publishers/subscribers, expanded service cards, and Mock API triggers. Allow crossings that manual positions force, without moving nodes to remove them.

## Risks / Trade-offs

- Routing during drag can cause visible lag on large graphs -> measure representative graph sizes, throttle intermediate recomputation, and finish with a full pass on drag stop.
- An async result can arrive after a newer drag position -> version each geometry snapshot and discard stale results.
- Fixed size estimates can make routes pass through expanded cards -> use measured dimensions and reroute on size changes.
- Orthogonal route changes can move timing labels -> select a visible segment and test label placement and interaction.
- ELK may not meet handle or performance requirements -> use the spike gate before committing to the dependency; fall back to a focused router evaluation if needed.

## Migration Plan

No data migration. Keep existing saved node positions. Introduce client-side routes behind the current edge rendering boundary, then replace Auto arrange after the layout spike passes. Rollback restores the previous arranger and step paths without changing stored canvas data.
