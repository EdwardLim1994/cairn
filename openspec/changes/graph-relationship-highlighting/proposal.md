# Proposal

## Why

Selecting a service currently accents only its card, so users cannot quickly see its configured relationship network. Highlighting the selected service and related services will show those links without changing the graph layout.

## What Changes

- When a service node is clicked, highlight its configured relationship network across service calls, message publish/subscribe links, and Mock API targets, traversing both incoming and outgoing links.
- Keep three service-distance levels for graph traversal and line gradients. Give the selected service the level 1 node accent, and give all related nodes the same level 2 node accent. Dim services and connections beyond level 3.
- Fade configured connection lines across each relationship step, with the strongest accent at level 1 and progressively weaker accents at levels 2 and 3.
- Clear the relationship highlight when the user clicks the blank canvas or presses Escape.
- Keep the viewport fixed when a service is clicked, and preserve telemetry-only observed edge styling independently of the configured relationship highlight.

## Capabilities

### New Capabilities

- `graph-relationship-highlighting`: Shows the configured connection network related to a selected service with emphasis based on distance.

### Modified Capabilities

None. The project has no durable capability specs yet.

## Impact

- Graph selection state, graph node and edge view models, Vue Flow canvas events, and light/dark graph styling.
- No persistence schema or API changes. No dependency changes.
