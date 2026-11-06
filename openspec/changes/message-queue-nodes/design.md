# Design

## Context

See `proposal.md` for the motivation and `specs/message-flow-graph/spec.md` and `specs/message-broker-health/spec.md` for user-visible behavior. The canvas currently supports service and mock API nodes, and service edges target registered endpoints. Graph as code is version 1 and contains services, endpoints, and endpoint-to-endpoint calls. OTLP ingestion stores trace IDs and parent span IDs, but does not retain span links.

## Goals / Non-Goals

**Goals:**

- Represent a specific logical event destination and its publishers and consumers.
- Keep Kafka topics and RabbitMQ topic exchanges visually consistent while retaining broker-specific routing keys and consumer information.
- Report broker connectivity without managing or inspecting broker destinations or topology.
- Round-trip destinations and their connections through graph persistence and Graph as code.
- Use observed telemetry, rather than declared graph connections, to determine actual traced service flow.

**Non-Goals:**

- Publish or consume application messages from Cairn.
- Create or modify Kafka topics, RabbitMQ exchanges, queues, bindings, or consumer groups.
- Inspect or validate whether a declared destination or subscription exists in broker topology.
- Correlate spans across different trace IDs through span links in this change.

## Decisions

### Render destinations in independently configured graph nodes

Persist each message destination as its own entity and associate it with a stable queue ID. A Kafka destination represents one topic; a RabbitMQ destination represents one topic exchange. Render one Message Queue node per queue ID, with topic-specific handles and independently saved broker settings and position. Existing destinations migrate together into a legacy queue so their current graph remains intact.

Clicking a Message Queue node opens a right-side settings panel listing only that queue's destinations and broker connection health. Creating a queue starts with an empty topic list; adding a topic associates it with the selected queue. Visual edges represent intent: registered service endpoints or event handlers publish to a destination, and services consume from it. Consumer edges target services because event handlers are not necessarily HTTP endpoints.

### Keep routing attributes on message connections

Represent publish and subscribe relationships as message connections separate from existing endpoint-to-endpoint call edges. A publisher can be a specific endpoint or a service-level event handler that publishes after consuming another event. Kafka subscription connections carry the consumer group. RabbitMQ publish connections carry a routing key and subscription connections carry a binding key. RabbitMQ queues and bindings are provisioned by user services; Cairn neither creates them nor confirms they exist.

Consumer subscriptions also act as valid sources for downstream service calls and republishing. Persist the source subscription identity on those relationships so graph handles and consumer cards can restore the same topology. Service targets remain registered endpoints; message destinations use publish connections and broker-specific routing attributes.

In service settings, endpoint and consumer cards use repeatable outbound rows. Each dropdown combines service endpoint and message destination targets; deleting a selected row removes the corresponding saved graph connection.

Render one graph output handle per saved outbound relationship and use its connection ID as the handle ID. This lets users see and identify each configured call while keeping unconnected endpoint and consumer rows available as drag sources.

### Store graph entities and queue positions

Persist destination definitions and message connections as project-scoped records with stable code keys. Persist each queue's visual position separately from its topic rows, while retaining fallback reads for legacy per-topic positions. Keep coordinates as canvas state, separate from destination configuration. Validate ownership and connection references within the same transaction when applying or saving graph state.

### Extend Graph as code with a compatible version

Introduce graph code version 2 with destination definitions and typed publish/subscribe connections using stable service, endpoint, and destination keys. Continue accepting version 1 manifests as service-only graphs. Serialize version 2 for graphs with messaging destinations; omit database IDs and canvas positions. Reject unknown references, duplicate keys, unsupported broker types, and invalid broker-specific connection attributes before persistence.

Do not serialize resolved credentials in graph code. Where a connection setting needs a secret, represent it through a project environment variable reference and resolve it only for a health check. This follows the existing project-variable convention while keeping exported graph code portable.

### Check broker connectivity without querying topology

Run a periodic protocol-level connectivity check from the Cairn server using the configured broker connection. Kafka checks establish an authenticated client connection and request cluster availability; RabbitMQ checks establish an AMQP connection and channel. Neither check lists topics, exchanges, queues, bindings, or consumer groups. Show each result beside its destination in the Message Queue node and settings panel, and report connection or authentication failures as offline.

### Derive actual event flow from telemetry

Use ingested spans sharing a trace ID to identify producer, consumer, and downstream service activity. The declared graph edge alone does not prove that an event was published or consumed. Add the messaging destination to observed trace flow when available from messaging span attributes. Do not claim a producer-consumer trace relationship when their spans do not share the propagated trace ID. Span-link persistence and cross-trace correlation remain out of scope.

## Risks / Trade-offs

- A RabbitMQ logical topic hides physical queues and bindings → Label connections with routing and binding keys and make clear that these are declared relationships, not broker-verified topology.
- Repeated health checks can create excess broker connections → Reuse clients where practical and keep polling on the existing health-check cadence.
- A broker can be reachable while a destination is misconfigured → Report only broker health and avoid presenting it as destination validation.
- Services may not propagate trace context through messages → Show only telemetry-observed flows and avoid inferring consumer activity from configured edges.
- Graph code can expose broker credentials → Serialize environment-variable references only and resolve values server-side for checks.

## Migration Plan

Add the destination and message-connection schema with a migration that leaves existing services, endpoints, mock APIs, edges, and positions intact. Existing version 1 graph code remains importable; newly serialized graphs use version 2. Roll back by reverting the application and migration before relying on destination records.
