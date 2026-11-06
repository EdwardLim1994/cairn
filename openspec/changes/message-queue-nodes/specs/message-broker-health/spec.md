# Spec Delta

## Purpose

Lets users see whether the Kafka or RabbitMQ broker configured for a message destination is reachable and healthy. Broker checks are read-only health checks and do not require Cairn to manage messaging topology.

## ADDED Requirements

### Requirement: Users can see Kafka broker health

The system SHALL periodically check connectivity to each configured Kafka broker and show its health next to the destination in the Message Queue node and settings panel.

#### Scenario: Kafka broker is reachable

- **WHEN** Cairn successfully connects to the configured Kafka broker
- **THEN** the destination shows the broker as online in the Message Queue node and settings panel

#### Scenario: Kafka broker is unavailable

- **WHEN** Cairn cannot connect to the configured Kafka broker
- **THEN** the destination shows the broker as offline in the Message Queue node and settings panel

### Requirement: Users can see RabbitMQ broker health

The system SHALL periodically check connectivity to each configured RabbitMQ broker and show its health next to the destination in the Message Queue node and settings panel.

#### Scenario: RabbitMQ broker is reachable

- **WHEN** Cairn successfully connects to the configured RabbitMQ broker
- **THEN** the destination shows the broker as online in the Message Queue node and settings panel

#### Scenario: RabbitMQ broker is unavailable

- **WHEN** Cairn cannot connect to the configured RabbitMQ broker
- **THEN** the destination shows the broker as offline in the Message Queue node and settings panel

### Requirement: Broker health checks do not manage topology

The system SHALL limit broker health checks to connectivity and health status and SHALL NOT create, modify, delete, or inspect topics, exchanges, queues, bindings, or consumer groups.

#### Scenario: Run a broker health check

- **WHEN** Cairn checks a configured Kafka or RabbitMQ broker
- **THEN** it reports broker health without changing or querying messaging topology
