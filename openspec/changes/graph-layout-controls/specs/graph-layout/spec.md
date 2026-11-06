# Spec Delta

## Purpose

Lets users organize service and Mock API nodes around declared call direction. It also protects the saved canvas from accidental node movement with a persistent project-level lock.

## ADDED Requirements

### Requirement: Users can arrange all graph nodes by call direction

The system SHALL provide an explicit action that positions all graph nodes to make declared service-call direction clear.

#### Scenario: Arrange a connected graph

- **WHEN** a user activates Auto arrange
- **THEN** the system positions caller services before target services from left to right
- **AND** the system positions each Mock API node before its target service
- **AND** the system saves the new node positions and fits the graph in the viewport

#### Scenario: Arrange services in a cycle

- **WHEN** services form a directed call cycle and a user activates Auto arrange
- **THEN** the system places the services in that cycle in the same layout layer while preserving their individual nodes and connections

#### Scenario: Arrange disconnected services

- **WHEN** a graph contains services without declared connections and a user activates Auto arrange
- **THEN** the system places them in stable, non-overlapping positions

#### Scenario: Arrange message queue nodes in a dedicated column

- **WHEN** a user activates Auto arrange with message queue nodes present
- **THEN** the system places all message queue nodes in their own column, separate from service nodes
- **AND** the system stacks message queue nodes without overlap

#### Scenario: Preserve space for collapsed services

- **WHEN** a user activates Auto arrange while service nodes are collapsed
- **THEN** the system reserves enough space for each service's expanded endpoint rows
- **AND** expanding those services does not cause node overlap

#### Scenario: Arrange while positions are locked

- **WHEN** a user activates Auto arrange while the position lock is enabled
- **THEN** the system arranges and saves all graph node positions
- **AND** the position lock remains enabled

### Requirement: Users can lock graph node positions

The system SHALL let users persistently lock or unlock node movement for the project canvas.

#### Scenario: Lock node movement

- **WHEN** a user enables the position lock
- **THEN** the system saves the locked state to the backend
- **AND** users cannot drag graph nodes
- **AND** users can still click service nodes to edit details and use graph connection actions

#### Scenario: Restore locked state

- **WHEN** a user reloads a canvas with its position lock enabled
- **THEN** the system restores the locked state and prevents node dragging

#### Scenario: Unlock node movement

- **WHEN** a user disables the position lock
- **THEN** the system saves the unlocked state to the backend
- **AND** users can drag graph nodes again
