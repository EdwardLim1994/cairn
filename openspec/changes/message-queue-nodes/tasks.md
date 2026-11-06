# Tasks

## 1. Persist message destinations and connections

- [x] 1.1 Add project-scoped message destination and typed publish/subscribe connection tables, stable destination keys, and graph position support; verify the Drizzle migration applies cleanly and existing graph records remain intact.
- [x] 1.2 Extend shared API contracts and server validation for Kafka topics, RabbitMQ topic exchanges, producer endpoint references, consumer service references, consumer groups, routing keys, and binding keys; verify valid and invalid references with focused schema and use-case tests.
- [x] 1.3 Extend canvas read/save repositories and APIs to load, save, validate, and delete message destinations and connections transactionally; verify graph state round-trips and rejects cross-project or stale references without partial writes.

## 2. Add message destination graph interactions

- [x] 2.1 Add create and edit flows for Kafka and RabbitMQ destinations in the Message Queue settings panel; render all destinations in one graph node.
- [x] 2.2 Render topic-specific producer and consumer handles with broker-specific connection labels, including RabbitMQ routing and binding keys and Kafka consumer groups.
- [x] 2.3 Persist one Message Queue node position while preserving each destination's connection and deletion behavior.
- [x] 2.4 Document the destination graph model and its declared-versus-observed flow behavior; verify project documentation matches the UI and API contracts.

## 3. Check Kafka and RabbitMQ broker health

- [x] 3.1 Add Kafka protocol connectivity checks using configured broker settings and project variable references for secrets; verify reachable, unavailable, and authentication-failure cases report the expected health status.
- [x] 3.2 Add RabbitMQ AMQP connectivity checks using configured broker settings and project variable references for secrets; verify reachable, unavailable, and authentication-failure cases report the expected health status.
- [x] 3.3 Run broker checks on the health refresh cadence and display status on destination nodes without querying or mutating broker topology; verify checks do not create or inspect topics, exchanges, queues, bindings, or consumer groups.

## 4. Extend Graph as code

- [x] 4.1 Define version 2 graph code with destination definitions and typed publish/subscribe connections using stable keys and secret variable references; verify version 1 service-only documents remain valid.
- [x] 4.2 Extend browser and server validation, apply, and serialization for destinations and message connections; verify duplicate keys, unknown references, and invalid broker-specific fields block apply without changing saved graph state.
- [x] 4.3 Preserve matching destination positions and place new destinations during graph code apply; verify serialized code omits database IDs, positions, and resolved secret values.

## 5. Correlate observed messaging traces

- [x] 5.1 Extend OTLP messaging span handling to associate spans with destination nodes by broker and destination attributes; verify messaging spans retain their trace IDs and destination identity.
- [x] 5.2 Include producer, consumer, and downstream services in trace visualization only when spans share the propagated trace ID; verify configured connections without matching telemetry are not shown as observed activity.
- [x] 5.3 Verify an end-to-end trace with a producer, message destination, consumer, and downstream service renders as an observed event flow.

## 6. Register the GraphQL Java microservices example

- [x] 6.1 Support service-level message publishers for event handlers while preserving endpoint publishers; persist, serialize, arrange, and render both connection forms.
- [x] 6.2 Add Graph as code for all 10 Spring Boot gRPC services, 5 GraphQL subgraphs, Apollo Router, and the five Kafka topics, including service, subgraph, router, and event-flow connections.
- [x] 6.3 Configure Apollo Router's `/health` API and Kafka protocol health check, and expose Kafka on a host listener reachable from Cairn's Docker container.

## 7. Connect message consumers to downstream work

- [x] 7.1 Persist subscription-sourced service calls and publishes through canvas APIs, validating that each source subscription belongs to the source service and each target belongs to the project.
- [x] 7.2 Render consumer-row output handles and route connections to service endpoints or message destinations, preserving connections when rows are collapsed.
- [x] 7.3 Add repeatable combined-target outbound-call controls to endpoint and consumer topic cards in service settings; verify calls can be added, removed, saved, and restored.
- [x] 7.4 Render a distinct source dot for every saved outbound call or publish and preserve its handle identity across layout changes and collapse.

## 8. Support independent message queue nodes

- [x] 8.1 Associate each destination with a queue ID and add a data-preserving migration that groups existing topics in a legacy queue.
- [x] 8.2 Render, position, edit, and save multiple queue nodes independently, including queue-specific topic lists and connections.
- [x] 8.3 Preserve queue assignments in Graph as code and auto-arrange; verify separate queues retain their topics, connections, and positions.
- [x] 8.4 Persist a custom display name for each queue and render it in the queue node header.
- [x] 8.5 Let users delete a queue and remove its topics and related connections.
