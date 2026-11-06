# Spec Delta

## Purpose

Lets users represent event destinations and service publishing or consuming relationships in the graph. Users can author the same messaging topology through Graph as code and relate messaging spans to the services that process an event.

## ADDED Requirements

### Requirement: The graph shows destinations in independently configured message queue nodes

The system SHALL let users create multiple Message Queue nodes. Each node SHALL own its broker type, connection URL, position, and list of Kafka topics or RabbitMQ topic exchanges while retaining topic-specific publisher and consumer handles.

#### Scenario: Display topics in separate queues

- **WHEN** a project contains destinations assigned to one or more queues
- **THEN** the graph displays one Message Queue node per queue, listing only that queue's destinations
- **AND** each destination has distinct handles for publisher and consumer connections

#### Scenario: Create an independent queue

- **WHEN** a user creates a Message Queue node
- **THEN** the new queue starts with its own broker settings and no topics from other queues
- **AND** adding or removing topics in that queue does not change the topics in another queue

#### Scenario: Collapse all graph nodes

- **WHEN** a user collapses all service nodes
- **THEN** each Message Queue node bundles its own topic rows into one row
- **AND** existing topic connections remain attached to their topic-specific handles at the bundled row

#### Scenario: Open message queue settings

- **WHEN** a user clicks the Message Queue node
- **THEN** a right-side settings panel opens with fields for the broker type and connection URL
- **AND** the panel lists topics in expandable cards with controls to create or remove topics
- **AND** the panel lets the user set a custom queue name that appears in the node header
- **AND** saving applies the broker settings and topic list only to the selected queue

#### Scenario: Delete a message queue

- **WHEN** a user removes a Message Queue node from its settings panel
- **THEN** the system removes the queue, its topics, their connections, and its saved position

### Requirement: Users can connect publishing endpoints to destinations

The system SHALL let users connect a registered service endpoint to a topic-specific handle on the Message Queue node to represent that the endpoint publishes events to that destination.

#### Scenario: Connect a service endpoint to a Kafka topic

- **WHEN** a user connects a service endpoint to a Kafka destination
- **THEN** the graph displays the endpoint as a publisher to that topic

#### Scenario: Connect a service endpoint to a RabbitMQ topic

- **WHEN** a user connects a service endpoint to a RabbitMQ destination and supplies a routing key
- **THEN** the graph displays the endpoint as a publisher using that routing key

The system SHALL also let users connect a service directly to a topic-specific handle on the Message Queue node when an asynchronous handler publishes an event without an HTTP or gRPC endpoint.

The service-level “Message publisher” row SHALL appear only when the service has a configured service-level publish connection.

#### Scenario: Connect an event handler to a Kafka topic

- **WHEN** a user connects a service that publishes from a message handler to a Kafka destination
- **THEN** the graph displays the service as a publisher of that topic without assigning a request endpoint

### Requirement: Users can connect consuming services to destinations

The system SHALL let users connect a topic-specific handle on the Message Queue node to a service that consumes events from that destination.

The service node SHALL show each configured subscription in its own consumer row, and service settings SHALL let users add, edit, and remove consumer subscriptions using the queue's configured topics.

#### Scenario: Connect a service to a Kafka topic

- **WHEN** a user connects a Kafka destination to a service and supplies its consumer group
- **THEN** the graph displays the service as a consumer of that topic and group

#### Scenario: Connect a service to a RabbitMQ topic

- **WHEN** a user connects a RabbitMQ destination to a service and supplies a binding key
- **THEN** the graph displays the service as a consumer matching that key

#### Scenario: Configure a service consumer in service settings

- **WHEN** a user adds a consumer subscription to a service in service settings
- **THEN** the service node displays a dedicated consumer row with a connection handle
- **AND** the graph connects the matching Message Queue topic to that row

#### Scenario: Collapse service consumer rows

- **WHEN** a user collapses a service node
- **THEN** its consumer rows appear as one bundled row
- **AND** each existing subscription remains connected through its topic-specific handle

### Requirement: Consumers can connect to downstream services and destinations

Each service consumer row SHALL expose an outbound connection handle. Endpoint and subscription cards SHALL let users manage repeatable downstream calls and publishes using one combined target dropdown.

#### Scenario: Manage multiple outbound targets in service settings

- **WHEN** a user adds an outbound call from an endpoint or consumer card
- **THEN** the card adds a dropdown containing other service endpoints and message destinations
- **AND** the user can add more dropdowns or delete a dropdown to remove its saved connection

### Requirement: Service rows show configured outbound connections

The graph SHALL display one distinct output dot for each configured outbound call or publish on its endpoint or consumer row. Each configured connection SHALL use its matching dot as its source.

#### Scenario: Show multiple outbound connection dots

- **WHEN** an endpoint or consumer has multiple configured outbound connections
- **THEN** the service node shows a separate output dot for each connection on that row
- **AND** each connection line starts at its matching dot

#### Scenario: Connect a consumer to a downstream service

- **WHEN** a user connects a service consumer row to another service endpoint
- **THEN** the graph displays a downstream call sourced from that consumer
- **AND** the consumer card lists the outbound call and allows its removal

#### Scenario: Connect a consumer to another message destination

- **WHEN** a user connects a service consumer row to a message destination
- **THEN** the graph displays the consumer as a publisher to that destination
- **AND** the consumer card lists the outbound publish and allows its removal

### Requirement: The graph preserves messaging topology

The system SHALL save and restore message destination nodes, their publishing and consuming connections, connection details, and node positions with the project graph.

#### Scenario: Reload a graph with message flows

- **WHEN** a user saves and reloads a graph containing message destinations
- **THEN** the system restores the destinations and their producer and consumer connections
- **AND** the system restores each Message Queue node's saved position and queue assignment

### Requirement: Graph as code supports message destinations

The system SHALL let users represent message destinations and publishing or consuming connections in Graph as code using stable destination keys.

#### Scenario: Import message flow definitions

- **WHEN** a user imports and applies valid graph code containing destinations and messaging connections
- **THEN** the graph contains the declared destinations and connections
- **AND** the system preserves positions for nodes with matching stable keys

#### Scenario: Serialize message flow definitions

- **WHEN** a user opens Graph as code for a graph containing message destinations
- **THEN** the editor includes destination definitions and their publishing and consuming connections
- **AND** the code does not include database IDs or canvas positions

#### Scenario: Preserve existing graph code documents

- **WHEN** a user imports a valid version 1 graph code document without message destinations
- **THEN** the system applies its services, endpoints, and endpoint calls with no message destinations

#### Scenario: Reject invalid messaging references

- **WHEN** graph code contains duplicate destination keys or references an unknown destination, service, or endpoint
- **THEN** the system reports the invalid reference and leaves the saved graph unchanged

### Requirement: Messaging trace flows use shared OpenTelemetry trace IDs

The system SHALL correlate producer, consumer, and downstream service spans when received telemetry contains the same trace ID as a result of propagated message context.

#### Scenario: Show a traced message flow

- **WHEN** producer, consumer, and downstream services emit spans with the same propagated trace ID
- **THEN** the graph can show the producer, destination, consumer, and observed downstream service flow for that trace

#### Scenario: Handle telemetry without message context

- **WHEN** producer and consumer spans do not share a trace ID
- **THEN** the system does not infer a trace relationship from the graph connection alone
