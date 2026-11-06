# Proposal

## Why

Cairn currently models service-to-service calls but cannot show event-driven flows through Kafka or RabbitMQ. Users need to see which service endpoint publishes to a destination and which services consume from it, while also seeing whether the broker is healthy and correlating instrumented message flows with traces.

## What Changes

- Add one message queue graph node that lists all configured Kafka topics and RabbitMQ topic exchanges.
- Open a right-side settings panel from the message queue node to view, add, and edit destinations.
- Let users connect service endpoints or event-producing services to destinations as publishers and destinations to services as consumers.
- Check Kafka and RabbitMQ broker health without creating, changing, or deleting broker topology.
- Extend Graph as code to import, validate, apply, and serialize destination nodes and their publish/subscribe connections.
- Use existing OpenTelemetry spans and propagated message context to show related consumers and downstream work by trace ID when telemetry provides that context.

## Capabilities

### New Capabilities

- `message-flow-graph`: Represent messaging destinations and publishing/consuming relationships in the graph and Graph as code.
- `message-broker-health`: Check and display health for configured Kafka and RabbitMQ brokers without mutating broker resources.

### Modified Capabilities

None. The repository has no durable OpenSpec capabilities yet.

## Impact

- Graph node and edge models, canvas APIs and persistence, graph layout, and graph-as-code manifest validation and serialization.
- Broker connection settings, credentials, health checks, and service configuration UI.
- Trace visualization that correlates messaging spans and downstream service spans when services propagate OpenTelemetry context.
- Kafka and RabbitMQ client or health-check dependencies and deployment configuration.
