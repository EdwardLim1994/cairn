# Spec Delta

## Purpose

Keeps graph connections readable as users arrange or drag service, message queue, and Mock API nodes on the project canvas.

## ADDED Requirements

### Requirement: Connections avoid node cards

The system SHALL route graph connections around node cards while keeping each connection attached to its designated source and target handles.

#### Scenario: Auto arrange a connected graph

- **WHEN** a user activates Auto arrange on a graph with connections
- **THEN** connection segments do not pass through unrelated node cards
- **AND** connections remain attached to their designated handles
- **AND** connection paths retain a square, orthogonal appearance

#### Scenario: Drag a node

- **WHEN** a user drags an unlocked node across the canvas
- **THEN** affected connections follow their handles and reroute around node cards as positions change
- **AND** routing is finalized when the drag ends

#### Scenario: Expand a graph node

- **WHEN** a node card changes size after expanding or collapsing
- **THEN** affected connections are rerouted around its current bounds

### Requirement: Auto arrange follows declared graph flow

The system SHALL use declared service calls, publish and subscribe connections, and Mock API targets when arranging graph nodes.

#### Scenario: Arrange a message flow

- **WHEN** a publisher service connects to a message queue consumed by another service and the user activates Auto arrange
- **THEN** the publisher, queue, and consumer are placed in that flow order
- **AND** the arranged nodes do not overlap

#### Scenario: Arrange service and Mock API connections

- **WHEN** a user activates Auto arrange on services with declared calls and Mock API triggers
- **THEN** callers precede their targets and each Mock API trigger precedes its target service where the graph topology permits
- **AND** arranged node positions are saved and fitted in the viewport

#### Scenario: Arrange a directed cycle

- **WHEN** declared connections form a cycle and the user activates Auto arrange
- **THEN** all nodes and connections in the cycle remain present and readable without node overlap

### Requirement: Reduce connection crossings

The system SHALL use connection crossings as a secondary optimization goal after avoiding node-card intersections during Auto arrange.

#### Scenario: Arrange a graph with alternate node orders

- **WHEN** a user activates Auto arrange and multiple non-overlapping arrangements preserve declared flow
- **THEN** the system selects an arrangement that reduces avoidable connection crossings

#### Scenario: Manually position nodes

- **WHEN** a user drags nodes into positions that force connections to cross
- **THEN** connections remain attached and avoid node cards
- **AND** the system may display unavoidable connection crossings

### Requirement: Preserve graph interaction and telemetry

The system SHALL preserve graph control and telemetry behavior when connection routes or node positions change.

#### Scenario: Reroute an observed connection

- **WHEN** an observed connection is rerouted
- **THEN** its timing label, per-call details, animation, and endpoint-dot highlighting remain associated with that connection

#### Scenario: Arrange while positions are locked

- **WHEN** the position lock is enabled and the user activates Auto arrange
- **THEN** nodes are arranged and saved while the lock remains enabled

#### Scenario: Open a trigger response panel

- **WHEN** a trigger node response panel opens after a run
- **THEN** its existing focus and viewport behavior is preserved
