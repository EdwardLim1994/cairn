# Tasks

## 1. Service API type and endpoint contracts

- [x] 1.1 Extend shared service, endpoint, canvas, and graph-as-code schemas for WebSocket services with `ws://`/`wss://` endpoint validation; verify REST, GraphQL, and gRPC contract tests still pass and add invalid-scheme/valid-address coverage.
- [x] 1.2 Update service repositories and persistence only where required for the WebSocket type; verify create, update, reload, and delete preserve existing service and endpoint IDs and API types.
- [x] 1.3 Add WebSocket service setup to the service editor and endpoint picker; verify component/API tests cover WebSocket setup and existing REST/GraphQL/gRPC editing paths.

## 2. WebSocket mock API configuration

- [x] 2.1 Add WebSocket mock API type, endpoint filtering, readiness rules, and text request editing using the existing request value; verify saved and reloaded text remains exact and only WebSocket endpoints can be selected.
- [x] 2.2 Apply existing authorization templates and custom headers to WebSocket handshake configuration; verify generated handshake headers and authorization failures with focused server tests.
- [x] 2.3 Update mock API settings UI and API contract tests for WebSocket creation, editing, and save/discard behavior; verify existing HTTP and gRPC settings continue to round-trip unchanged.

## 3. Server-side connection lifecycle

- [x] 3.1 Add a server-side WebSocket client dependency and endpoint-keyed runtime session registry; verify focused tests allow concurrent sessions for different endpoint IDs and reject a second session for an occupied endpoint.
- [x] 3.2 Implement Connect with handshake authorization, bounded initial retries, session status, and clear failure details; verify success, retry exhaustion, and endpoint-conflict behavior through use-case/API tests.
- [x] 3.3 Implement confirmed Disconnect and close sessions when mock API configuration, target endpoint, service, or endpoint is removed or changed; verify cancellation leaves the socket active and confirmed/deletion paths release the endpoint lock.
- [x] 3.4 Handle unexpected remote close without retrying and expose disconnected status to the UI; verify Trigger becomes unavailable after the close and the user can explicitly reconnect.

## 4. Trigger sends and incoming message delivery

- [x] 4.1 Implement Trigger to send the configured text message only on the owning open session; verify the exact text frame is sent and disconnected or wrong-session attempts do not send.
- [x] 4.2 Add a Cairn SSE event route for incoming WebSocket messages and connection state, with a bounded per-session in-memory buffer; verify messages stream live and buffered messages are available after the UI event stream reconnects.
- [x] 4.3 Add focused integration coverage for connect, trigger, incoming messages, disconnect, and endpoint exclusivity using a local WebSocket test server; verify the complete lifecycle without external services.

## 5. Graph trigger and response UI

- [x] 5.1 Add Connect/Disconnect and Trigger states to WebSocket graph nodes, including confirmation, disabled Trigger before connection, and failure toasts; verify node component tests cover connected, disconnected, connecting, and error states.
- [x] 5.2 Replace the global latest-run-only presentation for WebSocket sessions with a panel attached left of the trigger node; verify panel positioning follows the node and only one panel can be open.
- [x] 5.3 Display incoming messages only and add/clear the trigger-node unread indicator as the response panel closes/opens; verify messages continue arriving while hidden and panel visibility does not change session state.
- [x] 5.4 Update graph view-model and panel tests for multiple endpoints connected concurrently and competing APIs targeting one endpoint; verify switching response panels leaves both endpoint session states intact.

## 6. Documentation and integration validation

- [x] 6.1 Document WebSocket service setup, handshake authorization/headers, endpoint exclusivity, session controls, and the single-process session limitation; verify the instructions match the UI and server behavior.
- [x] 6.2 Run the focused WebSocket service, mock API, session, and graph tests plus `vp check` on changed paths; verify `openspec validate websocket-api-support --strict` succeeds.
