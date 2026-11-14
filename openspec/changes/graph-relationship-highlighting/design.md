# Design

## Context

See `proposal.md` and `specs/graph-relationship-highlighting/spec.md`. The graph store already holds a selected node ID. Clicking a service selects it and rebuilds graph nodes without changing viewport position or zoom. Configured service calls, message connections, and mock API targets are available in the graph view model. Runtime-only observed connections are tracked separately and carry telemetry styling and animation.

## Goals / Non-Goals

**Goals:**

- Derive a stable relationship level for the selected service and direct configured neighbors.
- Keep selected, direct-neighbor, and dimmed visual states distinguishable in light and dark themes.
- Preserve the current viewport position and zoom on node clicks, observed telemetry presentation, and other node interactions.

**Non-Goals:**

- Change graph layout, connection routing, persistence, or APIs.
- Traverse telemetry-only observed edges or use selection to change telemetry state.
- Start relationship highlighting from message queue or Mock API nodes.

## Decisions

### Compute undirected service distance over configured links

Build service adjacency from configured service calls and publisher/subscriber services attached to the same queue. Treat each relationship as traversable in both directions and run breadth-first search from the selected service, stopping after two service-to-service steps. Count the selected service as level 1, direct neighbors as level 2, and the next services as level 3. Queue nodes and Mock API triggers use the corresponding relationship level without consuming a service step. Do not add telemetry-only observed edges to adjacency.

Alternative: follow directed links only. Rejected because the selected service must show both inbound and outbound relationships.

### Keep three distance levels with a consistent related-node accent

Give the selected service the strongest outline and every related node through distance level 3 the same weaker outline. Keep three graph-distance levels for orienting SVG line gradients from nearer to farther endpoints. Dim more distant services and configured links. Keep telemetry-only observed edges outside relationship styling.

Alternative: give the next service ring a weaker node accent. Rejected because users want a consistent accent for all related services while line gradients retain distance information.

### Slightly thicken selected relationship lines

Increase the stroke width of level 1–3 configured relationship edges while a service is selected. Keep the base width for default and dimmed edges, and exclude running or completed runtime edges so Mock API execution styling keeps its existing width.

### Keep relationship emphasis separate from telemetry state

Represent relationship distance with additive node and edge state. Preserve existing observed/running classes, edge animation, and observed endpoint highlights. A telemetry-only edge remains outside the configured relationship network and retains its existing presentation.

Alternative: replace the existing edge class with a relationship class. Rejected because this would erase observed and running telemetry states.

### Clear selection through canvas interactions

Clear the selected service when the blank canvas is clicked. Handle Escape while the graph canvas is active and allow dialogs, editors, and other controls to consume Escape first. Service selection does not change the viewport. Selecting a non-service node does not start the service relationship highlight.

Alternative: clear selection whenever any node is clicked. Rejected because queue and Mock API interactions have their own selection and action behavior.

### Keep the viewport stable on service selection

Clicking a service updates selection and relationship styling without calling `fitView`. This lets users inspect relationships in place without losing their current graph context. Explicit graph fit or layout controls remain responsible for changing the viewport.

Alternative: focus the clicked service on every selection. Rejected because node selection should not disrupt the user's current pan and zoom.

### Clear edge gradient data when selection ends

Always replace edge data when rebuilding the graph, using an empty object when no relationship gradient applies. Vue Flow merges updated edge properties into existing edge records, so omitting `data` would leave a prior SVG gradient attached after selection clears.

## Risks / Trade-offs

- A dense network can still feel busy -> use one restrained accent for related nodes, keep distance gradients on connections, and dim unrelated services.
- Selection styling can obscure observed telemetry -> apply relationship state additively and retain existing observed/running styles and animation.
- Escape could interfere with open editors or dialogs -> only clear graph selection after higher-priority overlays have handled the key.
- Theme contrast can vary between light and dark palettes -> use existing accent tokens and verify selected, related, and dimmed states in both themes.

## Migration Plan

No data migration is needed. Add derived relationship distances to the client graph view model and clear selection from canvas interactions. Rollback removes the derived styling and handlers; persisted graph data remains unchanged.
