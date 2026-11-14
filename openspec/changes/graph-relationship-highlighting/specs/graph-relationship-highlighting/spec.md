# Spec Delta

## Purpose

Helps users understand a selected service's configured relationship network by highlighting reachable nodes and connections with emphasis based on graph distance.

## ADDED Requirements

### Requirement: Selecting a service highlights its configured relationship network

The system SHALL highlight nodes and connections reachable from a clicked service by traversing configured connections in both incoming and outgoing directions. Traversal SHALL include service calls, message publish/subscribe links through their queue nodes, and Mock API trigger-to-target links. Telemetry-only observed connections SHALL NOT affect traversal.

#### Scenario: Follow inbound and outbound chains

- **WHEN** a user clicks a service node
- **THEN** the system highlights directly related configured nodes and connections reached through inbound and outbound links
- **AND** the clicked service remains the strongest visual anchor

#### Scenario: Traverse a message flow

- **WHEN** the selected service is connected to other services through a message queue
- **THEN** traversal follows publisher-to-queue and queue-to-subscriber links in either direction
- **AND** it highlights the publisher, queue, and subscriber as one direct service relationship

#### Scenario: Ignore telemetry-only connections

- **WHEN** an observed runtime connection exists without a configured connection
- **THEN** it does not add nodes or connections to the selected service's relationship network
- **AND** its existing telemetry presentation remains independent

### Requirement: Relationship emphasis reflects service distance

The selected service SHALL be distance level 1, directly related services SHALL be distance level 2, and services one further service-to-service relationship away SHALL be distance level 3. The system SHALL NOT accent services beyond level 3. Message flows through a queue SHALL count as one service-to-service relationship. The selected node SHALL use the level 1 node accent, and all related nodes through distance level 3 SHALL use the same level 2 node accent.

#### Scenario: Limit service highlighting to three levels

- **WHEN** the selected service has related services at different service-to-service distances
- **THEN** the selected service is level 1
- **AND** directly related services are distance level 2
- **AND** services one further relationship away are distance level 3
- **AND** both related service groups use the same level 2 node accent
- **AND** services beyond distance level 3 are dimmed

### Requirement: Service nodes and connections show relationship levels

Related service nodes SHALL have the same visible level 2 accent outline through distance level 3. Configured connection lines SHALL fade between distance levels of their connected nodes. Configured connections outside the selected service's three-level network SHALL be dimmed. Mock API triggers SHALL use their target service's node accent.

#### Scenario: Fade connection lines across relationship levels

- **WHEN** a selected service has related services at different levels
- **THEN** the selected service has the strongest outline
- **AND** all related services through distance level 3 use the same weaker outline
- **AND** each connection line fades from the lower distance level toward the higher-level endpoint
- **AND** distance level 2 to level 3 connections use a weaker gradient than level 1 to level 2 connections
- **AND** more distant connections are dimmed

#### Scenario: Apply relationship emphasis in either theme

- **WHEN** a service is selected in light or dark theme
- **THEN** selected, related, and dimmed node states remain distinguishable
- **AND** connection gradients retain their three distance levels

### Requirement: Highlighted relationship connections use a thicker stroke

Configured connections in the selected service's relationship network SHALL use a slightly thicker stroke than default connections. Dimmed connections SHALL retain the default width. Running or completed Mock API trigger connections SHALL retain their runtime stroke width.

#### Scenario: Thicken highlighted configured connections

- **WHEN** a service node is selected and relationship highlighting is active
- **THEN** highlighted configured connection lines use a slightly thicker stroke than the default connection style
- **AND** unrelated dimmed connections and the default style remain unchanged

#### Scenario: Preserve mock execution connection width

- **WHEN** a Mock API trigger connection is running or has completed
- **THEN** its runtime stroke width is unchanged by service relationship highlighting

### Requirement: Relationship highlighting follows service selection

The system SHALL activate relationship highlighting only when a service node is clicked. It SHALL clear the relationship highlight when the user clicks the blank canvas or presses Escape. Selecting a service SHALL NOT move or refit the graph viewport. Telemetry behavior SHALL remain unchanged.

#### Scenario: Select a service node

- **WHEN** a user clicks a service node
- **THEN** the system activates its relationship highlight
- **AND** the graph viewport remains at its current position and zoom

#### Scenario: Clear selection from the graph canvas

- **WHEN** a user clicks the blank canvas or presses Escape while graph selection is active
- **THEN** the relationship highlight is cleared
- **AND** configured connection lines return to their default color

#### Scenario: Select a non-service node

- **WHEN** a user clicks a message queue or Mock API trigger node
- **THEN** the service relationship highlight is not activated
