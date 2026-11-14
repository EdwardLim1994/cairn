# Tasks

## 1. Derive relationship distances

- [x] 1.1 Derive undirected service-to-service adjacency from API calls and shared publisher/subscriber queues, then traverse at most two steps from the selected service; test bidirectional calls, queue-mediated service links, cycles, and telemetry-only edges.
- [x] 1.2 Assign levels 1–3 to the selected service and reachable neighbors; map queues and Mock API triggers without consuming service distance, and dim beyond-range configured edges; test all levels and unreachable elements.

## 2. Render relationship emphasis

- [x] 2.1 Preserve three-level graph distances for directional edge gradients while applying selected, related, and dimmed node states.
- [x] 2.3 Slightly thicken level 1–3 configured relationship edges while keeping default, dimmed, and running or completed Mock API trigger edge widths unchanged.
- [x] 2.4 Clear stale relationship gradient data on edge rebuilds and verify configured connections return to their default color when selection clears.
- [ ] 2.2 Verify the selected node uses the strongest accent, all related nodes share the same weaker accent, and dimmed elements remain distinct in light and dark themes.

## 3. Manage relationship selection

- [x] 3.1 Clear service relationship selection on blank-canvas click and Escape while allowing dialogs, editors, and other controls to handle Escape first; add interaction tests for clear behavior and non-service-node clicks.
- [x] 3.2 Activate relationship emphasis on service selection without moving or refitting the viewport; verify selection does not change pan or zoom.

## 4. Integration verification

- [ ] 4.1 Run focused graph tests and inspect a representative connected graph with service selection, blank-canvas clearing, Escape clearing, and both themes; confirm telemetry-only edge presentation remains independent.
