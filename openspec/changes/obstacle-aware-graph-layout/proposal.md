# Proposal

## Why

Auto arrange positions nodes, but connections can still pass through node cards or cross one another. Message queues are placed after services regardless of publish and subscribe flow, making connected paths harder to follow.

## What Changes

- Make avoiding node-card intersections the first priority for graph connections, including while a node is dragged.
- Arrange services, message queues, and Mock API triggers according to their declared connections, including publisher-to-queue-to-consumer paths.
- Reduce connection crossings as a secondary layout goal. Some crossings may remain when users manually place nodes.
- Keep square, orthogonal connections attached to their current endpoint handles and preserve observed timing labels, highlighting, and response-panel behavior.
- Keep Auto arrange explicit, save its node positions, and preserve the existing position lock and canvas controls.

## Capabilities

### New Capabilities

- `graph-routing`: Defines obstacle avoidance, drag-time rerouting, and crossing reduction for the graph.

### Modified Capabilities

None. The project has no durable OpenSpec capability specs yet.

## Impact

- Graph layout and edge rendering, Vue Flow node/edge view models, drag handling, and layout tests.
- A layout/routing library may be added if a representative graph spike confirms that it meets the handle, obstacle, and performance requirements.
- No graph persistence schema or API change is intended; arranged node positions continue through the existing canvas API.
