# Proposal

## Why

Service nodes are placed where users add them, so a canvas can become crowded and service-call direction is hard to read. Users need a one-click layout and a persistent position lock to organize the graph and avoid accidental moves.

## What Changes

- Add an explicit Auto arrange action that lays out service nodes from callers toward targets and places Mock API nodes by their target services.
- Keep services in cyclic call groups in the same layout layer and arrange disconnected services deterministically.
- Save arranged node positions and fit the viewport to the result.
- Add a persistent, project-scoped position lock that prevents node dragging while preserving node clicks and connection actions.
- Allow Auto arrange to reposition nodes even while position lock is enabled.

## Capabilities

### New Capabilities

- `graph-layout`: Arrange graph nodes by service call direction and protect saved positions with a persistent lock.

### Modified Capabilities

None. The repository has no durable OpenSpec capabilities yet.

## Impact

- Graph toolbar and Vue Flow interaction state.
- Canvas API contract and project canvas persistence for the lock setting.
- Service and Mock API node positions, which are already saved through the canvas API.
- Graph layout logic; no layout package is currently installed.
