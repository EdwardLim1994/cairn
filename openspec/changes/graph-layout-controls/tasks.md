# Tasks

## 1. Persist position lock

- [x] 1.1 Add a project-level `nodesLocked` field and migration with an unlocked default; verify existing projects migrate without changing node positions.
- [x] 1.2 Add the lock field to canvas GET and PUT contracts and persistence; verify lock state round-trips through repository and API tests.

## 2. Arrange the graph

- [x] 2.1 Implement deterministic service layers with cycle grouping, stable ordering, target-grouped Mock API nodes, and expanded-height spacing; verify connected, cyclic, disconnected, and collapsed layouts with focused layout tests.
- [x] 2.2 Add the Auto arrange toolbar action, save all service and Mock API positions, then fit the viewport; verify one action updates positions and reload restores them.
- [x] 2.3 Place all message queue nodes in a dedicated auto-arrange column and stack them without overlap.

## 3. Lock graph movement

- [x] 3.1 Add a toolbar lock toggle that saves immediately and restores prior state if saving fails; verify lock state persists after canvas reload.
- [x] 3.2 Apply lock state to all node dragging while preserving node clicks and connection actions; verify service editing and graph connections still work in locked mode.
- [x] 3.3 Verify Auto arrange remains available while locked, updates saved positions, and leaves the lock enabled.
