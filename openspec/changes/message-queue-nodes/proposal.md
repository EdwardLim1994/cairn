# Proposal

## Why

Cairn currently models service-to-service calls but cannot show event-driven flows through Kafka or RabbitMQ. Users need to see which service endpoint publishes to a destination and which services consume from it, while also seeing whether the broker is healthy and correlating instrumented message flows with traces.

## What Changes

- Add logical message destination nodes for Kafka topics and RabbitMQ topic exchanges.
- Let users connect service endpoints to destinations as publishers and destinations to services as consumers.
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
