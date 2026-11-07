# Design

## Context

See proposal.md for motivation and the spec deltas for user-visible behavior. Cairn currently stores service API types and endpoint records in shared schemas, sends mock API calls through synchronous server use cases, and derives one trigger node per saved mock API. Run results and the latest response are held in client state; the current response drawer is global. There is no persistent outbound connection manager.

The current service schema explicitly lists REST and gRPC, while the completed GraphQL change specifies GraphQL service and mock API behavior. Extending API type unions must retain all four existing/intended types: REST, GraphQL, gRPC, and WebSocket.

## Goals / Non-Goals

**Goals:**

- Add raw WebSocket endpoints and mock API sessions without changing REST, GraphQL, or gRPC behavior.
- Keep target WebSocket connections on Cairn's server so saved authorization and headers can be applied during the handshake.
- Allow one active mock API session per registered WebSocket endpoint and concurrent sessions to different endpoints.
- Forward incoming messages to the UI while allowing graph-node connection controls to work independently of response-panel visibility.

**Non-Goals:**

- GraphQL subscriptions or GraphQL-over-WebSocket protocol support.
- REST SSE response streaming or gRPC streaming in this change.
- Automatic reconnection after an established session drops.
- Multiple simultaneous mock API sessions to one endpoint.
- Persisting live socket state or WebSocket message streams in call history.

## Decisions

### Model WebSocket as a service API type and mock API type

Extend the service API type with `WEBSOCKET` and mock API type with `WEBSOCKET`. A WebSocket endpoint stores its complete `ws://` or `wss://` URL and has no HTTP method or gRPC RPC method. Preserve endpoint IDs and existing REST, GraphQL, and gRPC shapes. GraphQL support must remain represented while shared contracts are updated, even though the current service schema omits it.

Alternative considered: add a WebSocket transport flag to REST services. This would mix raw message exchange with HTTP request/response semantics and make endpoint filtering and graph controls ambiguous.

### Store the configured text message in the existing request value

Use the existing mock API request JSON value to store a string for WebSocket entries. In the settings panel, render a plain text editor labeled Message; on Trigger, send the saved string as one WebSocket text frame. This avoids a separate message table or request-body column. REST and GraphQL continue to use their current request formats.

Alternative considered: add a new persisted `requestMessage` field. That is clearer at the database level but adds a migration and another request representation when the existing JSON column can hold a string.

### Keep outbound socket sessions in a server-side endpoint registry

Add a process-local registry keyed by project and registered endpoint ID. A session records its owning mock API ID and the live client socket. Reject a second Connect for an occupied endpoint with a conflict response that identifies the active session. Sessions for different endpoint IDs can coexist. Socket state is ephemeral and is not written to MySQL; application restart closes all sessions and the UI reports them disconnected.

Use a server-side WebSocket client that supports `ws://`, `wss://`, and custom handshake headers. Resolve the selected mock API's existing authorization template and custom headers before connecting. Do not pass HTTP-only request bodies or REST headers unrelated to the WebSocket handshake.

On initial connection failure, make up to three attempts with a short bounded delay, then return a failure for the UI to show as a toast. Once a connection has opened, a later close marks it disconnected; do not retry automatically. A confirmed Disconnect closes the socket and releases the endpoint registry entry. Deleting a mock API, endpoint, or service, or changing the endpoint/auth/header configuration for an active session, also closes that session so stale credentials or targets are not retained.

Alternative considered: persist session ownership in the database. Live sockets cannot survive a process restart and persisting an active flag could leave stale state, so the registry remains runtime-only.

### Separate control calls from incoming-message delivery

Use authenticated Cairn server routes for Connect, Trigger, Disconnect, session status, and incoming-message subscription. Connect completes only after the target handshake succeeds. Trigger sends the configured text frame on the owned open socket and does not wait for a response. An application-level response may arrive later or more than once.

Forward incoming frames from the server registry to the browser through a Cairn SSE event stream. This SSE stream is an internal server-to-browser delivery mechanism; it does not add SSE as a target mock API type. Keep a bounded in-memory message buffer per active endpoint so messages arriving while the panel is hidden can be displayed when opened. Do not persist outbound frames in the response panel; display incoming text frames only.

Alternative considered: open the target WebSocket directly from the browser. That would make applying Cairn's stored authorization templates and enforcing endpoint-wide session exclusivity harder, and would move outbound connection behavior outside the existing server-side API boundary.

### Keep connection controls on trigger nodes and response panels observational

WebSocket trigger nodes show Connect or Disconnect state plus Trigger. Trigger is disabled until connection success. Disconnect asks for confirmation before issuing the server close. A server close or failed handshake updates the node state and disables Trigger.

Attach the response panel to its trigger node on the node's left. Track one open panel ID globally; changing panel visibility does not touch session state. Incoming messages received while the panel is closed set an unread indicator on that trigger node. Opening the panel clears its indicator. Keep messages in runtime client state until the next connection or page reload; this feature does not extend existing REST/GraphQL call-history persistence.

Alternative considered: keep the existing global latest-run drawer. It cannot show which persistent WebSocket session produced each incoming message and is not positioned beside the trigger being monitored.

### Limit session deployment to one Cairn process

The process-local registry is the source of truth for active sessions. This matches the current single Cairn app process in the local Compose deployment and avoids introducing a broker for the first version. A horizontally scaled deployment would require endpoint affinity or a shared session manager and is not covered here.

## Risks / Trade-offs

- [The UI can lose its event stream while the target socket remains live] → Keep connection state in the server registry, allow the UI to resubscribe, and buffer a bounded number of incoming messages.
- [A server restart closes every active session] → Treat sessions as ephemeral and show disconnected state after restart; the user explicitly reconnects.
- [Two service records may point to the same WebSocket URL] → Enforce exclusivity by registered endpoint identity in this version; document URL deduplication as a possible follow-up if duplicate registrations become common.
- [An endpoint can flood Cairn with messages] → Bound the in-memory per-endpoint buffer and discard the oldest entries when full.
- [The current shared service schema does not list GraphQL although its completed change specifies it] → Extend contracts without removing GraphQL and add compatibility checks for existing service and mock API records.
- [In-memory exclusivity does not span multiple Cairn replicas] → Keep deployment to one app process for this feature; revisit a shared session manager before horizontal scaling.

## Migration Plan

1. Add WebSocket to service and mock API API-type contracts and validation while preserving existing saved types and endpoint IDs.
2. Store the WebSocket request as a string value in the existing request JSON field; no live session or message table is added.
3. Deploy the server session routes and UI together. Existing records continue to load with their current API types and behavior.
4. Roll back by deploying the prior application and restoring the database only if a later migration changes persisted endpoint or mock API shapes. Live WebSocket sessions end when the application is rolled back or restarted.

## Open Questions

None. Use a small bounded buffer and a short retry delay as implementation defaults.
