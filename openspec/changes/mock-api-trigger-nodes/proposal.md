# Proposal

## Why

The shared Mock APIs graph node and its many endpoint edges make service relationships harder to read as the number of mock APIs grows. Compact per-API trigger nodes placed beside their target services keep execution controls visible while making each target relationship easier to follow.

## What Changes

- Replace the shared Mock APIs graph node with one compact trigger node for each configured mock API.
- Show each trigger node's full API name and an icon-only trigger button, and disable the button when that mock API is deactivated.
- Automatically place trigger nodes near their targeted service, allow users to move them, and connect each node to its configured endpoint.
- Keep the Mock APIs header action as the place to create and configure mock APIs; show target endpoint mapping in that panel.
- Preserve service-to-service graph connections and animate connections observed in the selected trace.
- Remove mock API node-specific graph status and highlighting; run results, logs, and history continue to show call outcomes.

## Capabilities

### New Capabilities

- `mock-api-triggering`: Compact graph trigger nodes, endpoint connections, placement, and execution behavior for configured mock APIs.

### Modified Capabilities

None.

## Impact

- Affects graph view-model node generation, graph interactions, canvas layout persistence, and the graph node components.
- Affects the main toolbar and Mock APIs panel entry point.
- Reuses existing mock API run behavior and trace observation; no new API endpoint or dependency is expected.
