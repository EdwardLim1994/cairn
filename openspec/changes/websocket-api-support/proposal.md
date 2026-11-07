# Proposal

## Why

Cairn can trigger request/response APIs, but it cannot open a persistent WebSocket session and exchange messages. Adding raw WebSocket support lets users test services that require a live, two-way connection while keeping the interaction visible in the service graph.

## What Changes

- Add raw WebSocket as a service API type alongside REST, GraphQL, and gRPC, with `ws://` and `wss://` endpoints.
- Add WebSocket mock APIs with a required text message, handshake authorization and custom headers, and graph-node Connect/Disconnect and Trigger actions.
- Keep one active mock API session per WebSocket endpoint while allowing sessions to different endpoints concurrently.
- Show incoming messages in the API response panel and indicate unread messages on the trigger node.
- Defer GraphQL subscriptions, automatic reconnect after an established session drops, and multiple simultaneous sessions to the same endpoint.

## Capabilities

### New Capabilities

- `websocket-service-endpoints`: Register and validate services that expose raw WebSocket endpoints.
- `websocket-mock-apis`: Configure text messages, manage endpoint sessions, trigger sends, and inspect incoming responses.

### Modified Capabilities

None. The project has no promoted main specs; related behavior is currently described by change-local specs.

## Impact

Service and endpoint contracts, service registration and editing, mock API persistence and readiness, outbound connection handling, graph trigger nodes, response panels, and run/session state. Existing REST, GraphQL, and gRPC behavior must remain supported as service API types are extended.
