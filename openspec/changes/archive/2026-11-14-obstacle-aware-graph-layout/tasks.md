# Tasks

## 1. Routing feasibility

- [ ] 1.1 Build representative graph fixtures covering service calls, publisher-to-queue-to-consumer paths, cycles, triggers, expanded cards, and manual positions; verify fixtures expose node-card intersections and crossing counts in the current layout.
- [ ] 1.2 Spike ELK layered orthogonal layout with measured node bounds and explicit handle ports; record route clearance, handle alignment, crossing counts, and runtime on the fixtures, then choose ELK or a focused obstacle-aware router based on those results.

## 2. Node layout and routed edges

- [ ] 2.1 Model service, message queue, and Mock API connections in the chosen layout input; verify focused layout tests place publisher, queue, consumer, callers, targets, cycles, and disconnected nodes without node overlap.
- [ ] 2.2 Render explicit orthogonal route points in the existing edge component and place timing labels on routed segments; verify focused edge tests preserve handle attachment, labels, per-call details, and observed animation.
- [ ] 2.3 Apply routed positions through the existing Auto arrange action and canvas save flow; verify focused canvas tests cover viewport fitting and the enabled position lock.

## 3. Manual movement and dynamic geometry

- [ ] 3.1 Reroute affected connections from current geometry during drag and run a complete pass on drag stop; verify interaction tests cover handle attachment, obstacle clearance, and stale async result rejection.
- [ ] 3.2 Reroute after node bounds or handle positions change, including expand/collapse and response-panel geometry; verify tests cover card clearance and unchanged response-panel focus behavior.

## 4. Integrated validation

- [ ] 4.1 Compare before/after fixture metrics and visually inspect representative light and dark graphs; verify no connection crosses an unrelated card and that crossings are reduced where arrangement permits.
- [ ] 4.2 Run focused `vp check <changed paths>`, `vp test run <test paths>`, relevant project validation scripts, and `openspec validate obstacle-aware-graph-layout --strict`; verify each command passes or record a concrete blocker.
