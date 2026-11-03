# Design

## Context

See `proposal.md` for motivation and `specs/graph-layout/spec.md` for required behavior. The current canvas stores service and Mock API node positions through the canvas API. New services begin at the context-menu position, Mock API nodes default to the left of their target, and Vue Flow fits the viewport on initialization without arranging nodes. The project row already stores canvas viewport settings.

## Goals / Non-Goals

**Goals:**

- Provide a deliberate, repeatable layout based on declared service-call direction.
- Keep nodes separated when service endpoint rows are expanded after arranging a collapsed graph.
- Persist node-lock state per project and restore it with the canvas.
- Let users explicitly arrange positions while the lock remains enabled.

**Non-Goals:**

- Automatically rearrange nodes after graph edits or page reloads.
- Infer service relationships from observed telemetry.
- Optimize edge crossings or produce a publication-quality diagram.

## Decisions

### Use a deterministic layered layout without a layout dependency

Build the layout from declared service calls. Collapse strongly connected service groups into components, topologically rank the resulting acyclic graph from callers to targets, and place components in left-to-right layers. Place members of a cycle in the same layer. Place disconnected services in stable rows. Sort services within each layer by stable service identity so repeated Auto arrange clicks produce the same layout.

Place Mock API nodes in a column before their target service and stack multiple triggers with stable spacing. Compute vertical spacing using each service's expanded height, even while it is collapsed. This leaves extra space in the collapsed view but prevents overlaps when endpoint rows expand.

Do not add Dagre or ELK for the first version. A deterministic component-and-layer layout handles the agreed behavior and keeps the dependency list unchanged. Stable sorting does not minimize edge crossings; consider a layout library only if real graphs remain hard to read.

Auto arrange updates all current node positions, saves them through the existing canvas API, then fits the viewport. It runs only on explicit user action and does not change the lock state.

### Persist position lock with project canvas settings

Add a `nodesLocked` boolean to the project row, defaulting to `false`, and include it in canvas GET and PUT contracts. Existing projects migrate to unlocked state. Save a lock toggle through the existing canvas API and restore it when loading the canvas.

Bind Vue Flow's global node-drag setting to the lock state. Remove the Mock API node's explicit `draggable: true` override so the global lock applies to every node. Keep connection handles and node-click handlers enabled. Auto arrange writes positions directly through the graph state and canvas API, so users can reorganize nodes without unlocking first.

## Risks / Trade-offs

- Stable layer ordering may leave crossing wires → Keep service order deterministic; defer crossing reduction until graph examples show it is needed.
- Space reserved for expanded services makes collapsed layouts less compact → Prefer predictable expansion over overlap; users can still pan and zoom.
- Canvas save can fail after a lock toggle → Restore the previous lock state and show the existing canvas error.

## Migration Plan

Add the project-level boolean with a default of `false`, then expose it in canvas read/write contracts. Existing node positions and graph relationships remain unchanged. Roll back by removing the field and column; saved positions remain valid.

## Open Questions

None.
