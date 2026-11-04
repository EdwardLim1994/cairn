# Tasks

## 1. Persist message destinations and connections

- [ ] 1.1 Add project-scoped message destination and typed publish/subscribe connection tables, stable destination keys, and graph position support; verify the Drizzle migration applies cleanly and existing graph records remain intact.
- [ ] 1.2 Extend shared API contracts and server validation for Kafka topics, RabbitMQ topic exchanges, producer endpoint references, consumer service references, consumer groups, routing keys, and binding keys; verify valid and invalid references with focused schema and use-case tests.
- [ ] 1.3 Extend canvas read/save repositories and APIs to load, save, validate, and delete message destinations and connections transactionally; verify graph state round-trips and rejects cross-project or stale references without partial writes.

## 2. Add message destination graph interactions

- [ ] 2.1 Add create and edit flows for Kafka and RabbitMQ destination nodes with broker connection settings and destination names; verify users can create, edit, and remove nodes from the graph.
- [ ] 2.2 Render producer and consumer connection handles and broker-specific connection labels, including RabbitMQ routing and binding keys and Kafka consumer groups; verify publish edges start at service endpoints and consume edges target services.
- [ ] 2.3 Add destination node layout, position persistence, and deletion behavior; verify nodes arrange without overlap and positions restore after reload.
- [ ] 2.4 Document the destination graph model and its declared-versus-observed flow behavior; verify project documentation matches the UI and API contracts.

## 3. Check Kafka and RabbitMQ broker health

- [ ] 3.1 Add Kafka protocol connectivity checks using configured broker settings and project variable references for secrets; verify reachable, unavailable, and authentication-failure cases report the expected health status.
- [ ] 3.2 Add RabbitMQ AMQP connectivity checks using configured broker settings and project variable references for secrets; verify reachable, unavailable, and authentication-failure cases report the expected health status.
- [ ] 3.3 Run broker checks on the health refresh cadence and display status on destination nodes without querying or mutating broker topology; verify checks do not create or inspect topics, exchanges, queues, bindings, or consumer groups.

## 4. Extend Graph as code

- [ ] 4.1 Define version 2 graph code with destination definitions and typed publish/subscribe connections using stable keys and secret variable references; verify version 1 service-only documents remain valid.
- [ ] 4.2 Extend browser and server validation, apply, and serialization for destinations and message connections; verify duplicate keys, unknown references, and invalid broker-specific fields block apply without changing saved graph state.
- [ ] 4.3 Preserve matching destination positions and place new destinations during graph code apply; verify serialized code omits database IDs, positions, and resolved secret values.

## 5. Correlate observed messaging traces

- [ ] 5.1 Extend OTLP messaging span handling to associate spans with destination nodes by broker and destination attributes; verify messaging spans retain their trace IDs and destination identity.
- [ ] 5.2 Include producer, consumer, and downstream services in trace visualization only when spans share the propagated trace ID; verify configured connections without matching telemetry are not shown as observed activity.
- [ ] 5.3 Verify an end-to-end trace with a producer, message destination, consumer, and downstream service renders as an observed event flow.
