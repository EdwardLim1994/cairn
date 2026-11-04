# Spec Delta

## Purpose

Lets users represent event destinations and service publishing or consuming relationships in the graph. Users can author the same messaging topology through Graph as code and relate messaging spans to the services that process an event.

## ADDED Requirements

### Requirement: Users can create message destination nodes

The system SHALL let users explicitly create a Kafka topic or RabbitMQ topic destination node with a name and broker connection details.

#### Scenario: Create a Kafka topic node

- **WHEN** a user creates a Kafka destination with a broker connection and topic name
- **THEN** the graph displays a node representing that topic

#### Scenario: Create a RabbitMQ topic node

- **WHEN** a user creates a RabbitMQ destination with a broker connection and topic exchange name
- **THEN** the graph displays a node representing that logical topic

### Requirement: Users can connect publishing endpoints to destinations

The system SHALL let users connect a registered service endpoint to a message destination to represent that the endpoint publishes events there.

#### Scenario: Connect a service endpoint to a Kafka topic

- **WHEN** a user connects a service endpoint to a Kafka destination
- **THEN** the graph displays the endpoint as a publisher to that topic

#### Scenario: Connect a service endpoint to a RabbitMQ topic

- **WHEN** a user connects a service endpoint to a RabbitMQ destination and supplies a routing key
- **THEN** the graph displays the endpoint as a publisher using that routing key

### Requirement: Users can connect consuming services to destinations

The system SHALL let users connect a message destination to a service that consumes events from it.

#### Scenario: Connect a service to a Kafka topic

- **WHEN** a user connects a Kafka destination to a service and supplies its consumer group
- **THEN** the graph displays the service as a consumer of that topic and group

#### Scenario: Connect a service to a RabbitMQ topic

- **WHEN** a user connects a RabbitMQ destination to a service and supplies a binding key
- **THEN** the graph displays the service as a consumer matching that key

### Requirement: The graph preserves messaging topology

The system SHALL save and restore message destination nodes, their publishing and consuming connections, connection details, and node positions with the project graph.

#### Scenario: Reload a graph with message flows

- **WHEN** a user saves and reloads a graph containing message destinations
- **THEN** the system restores the destinations and their producer and consumer connections
- **AND** the system restores each destination node's saved position

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
