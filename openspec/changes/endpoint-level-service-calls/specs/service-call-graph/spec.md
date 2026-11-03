# Spec Delta

## Purpose

Lets users define and inspect calls between specific service endpoints. Each relationship keeps its source and target endpoint identity across graph interactions and saved state.

## ADDED Requirements

### Requirement: Users can connect specific service endpoints

The system SHALL represent each newly created declared service call with a source endpoint and a target endpoint.

#### Scenario: Connect endpoints on the graph

- **WHEN** a user connects an expanded source endpoint to a target endpoint on another service
- **THEN** the system saves a relationship between those endpoint identities and displays its wire

#### Scenario: Restore endpoint relationships

- **WHEN** a user reloads a saved graph
- **THEN** the system restores each relationship between the same source and target endpoints

### Requirement: Users can assign a source endpoint to existing service calls

The system SHALL preserve existing service calls that lack a source endpoint as unassigned calls until a user reassigns their graph wire.

#### Scenario: Preserve unassigned calls after upgrade

- **WHEN** the system loads a saved service call that has no source endpoint
- **THEN** the system keeps the call and displays its wire from the service-level connection point

#### Scenario: Reassign an unassigned call wire

- **WHEN** a user expands the service and reconnects an unassigned call wire to a specific source endpoint
- **THEN** the system saves that source endpoint identity and displays the wire from that endpoint

### Requirement: Users can manage outbound calls in endpoint settings

The system SHALL show each endpoint's outbound calls in its expanded settings card and let users add a target endpoint or remove an existing call.

#### Scenario: Add an outbound call in endpoint settings

- **WHEN** a user selects an available target endpoint from the outbound calls dropdown
- **THEN** the system adds a relationship from the current endpoint to the selected endpoint and displays its graph wire

#### Scenario: Confirm removal of an outbound call

- **WHEN** a user requests deletion of an outbound call and confirms the action
- **THEN** the system removes the relationship and its graph wire

#### Scenario: Cancel removal of an outbound call

- **WHEN** a user requests deletion of an outbound call and cancels the action
- **THEN** the system keeps the relationship and its graph wire

### Requirement: Collapsing endpoints changes only graph presentation

The system SHALL preserve endpoint identities when it bundles inbound or outbound connections into shared visual connection points.

#### Scenario: Bundle connections while collapsed

- **WHEN** a user collapses a service's endpoint rows
- **THEN** the graph bundles the visible connection points while retaining each relationship's source and target endpoint identities

#### Scenario: Manage graph wires while expanded

- **WHEN** a service's endpoint rows are expanded
- **THEN** the user can create, edit, or delete wires from the specific endpoint rows
- **AND** the user can reassign an unassigned call wire to a specific endpoint

### Requirement: OpenAPI import does not create outbound calls

The system SHALL import endpoint definitions from an OpenAPI document without inferring or creating service call relationships.

#### Scenario: Import endpoints without relationships

- **WHEN** a user imports an OpenAPI document containing one or more operations
- **THEN** the system adds the supported endpoint definitions
- **AND** the system creates no outbound call relationships for those endpoints
