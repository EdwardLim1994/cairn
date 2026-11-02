# Spec Delta

## Purpose

Lets users trigger configured mock APIs directly from compact graph nodes while keeping each target endpoint relationship visible and the service graph readable.

## ADDED Requirements

### Requirement: Users can trigger mock APIs from individual graph nodes

The system SHALL show each saved mock API with a valid target endpoint as a graph node that displays its full name and an icon-only trigger button connected to that endpoint. Users SHALL be able to move trigger nodes, and the graph SHALL preserve their positions after saving and reloading.

#### Scenario: Show a configured mock API trigger

- **WHEN** the graph loads a saved mock API with a valid target endpoint
- **THEN** the graph displays a node with the full mock API name and an icon-only trigger button
- **AND** the node connects to the selected endpoint

#### Scenario: Omit an API without a target endpoint

- **WHEN** a saved mock API has no valid target endpoint
- **THEN** the graph does not display a trigger node for that API

### Requirement: Trigger nodes are automatically placed near their target service

The system SHALL place each trigger node near the service that owns its target endpoint and keep the placement associated with that service when the graph is loaded or the service is moved.

#### Scenario: Place multiple triggers beside one service

- **WHEN** multiple saved mock APIs target endpoints on the same service
- **THEN** their trigger nodes appear as a readable group near that service without overlapping one another

#### Scenario: Move a target service

- **WHEN** a user moves a service on the graph
- **THEN** its associated trigger nodes move with the service group

#### Scenario: Move and persist a trigger node

- **WHEN** a user moves a trigger node and the canvas saves
- **THEN** the graph stores that mock API's position
- **AND** the trigger node retains its saved position when the graph reloads

### Requirement: Inactive mock APIs cannot be triggered from the graph

The system SHALL disable a mock API's Trigger button while that mock API is deactivated and SHALL use the existing mock API run behavior when an active API is triggered.

#### Scenario: Trigger an active mock API

- **WHEN** a user selects Trigger for an active mock API
- **THEN** the system runs that mock API using its saved configuration

#### Scenario: Trigger a deactivated mock API

- **WHEN** a mock API is deactivated
- **THEN** its Trigger button is disabled
- **AND** selecting it does not send a request

### Requirement: Live trigger connections show request activity

The system SHALL highlight the connection from a mock API trigger node to its target service while that mock API call is running without animating it. Once the call has completed or failed, the system SHALL animate that connection.

#### Scenario: Show trigger activity and completion

- **WHEN** a mock API call is running
- **THEN** its trigger node to service connection is highlighted without animation
- **WHEN** the mock API call completes or fails
- **THEN** its trigger node to service connection is highlighted and animated

### Requirement: Users can open mock API configuration from the main page

The system SHALL provide a main-page header action that opens the Mock APIs panel for creating and configuring mock APIs, including selecting each API's target endpoint.

#### Scenario: Open mock API configuration

- **WHEN** a user selects the Mock APIs header action
- **THEN** the Mock APIs configuration panel opens
- **AND** the user can select or change a mock API's target endpoint there

### Requirement: Trace observations remain visible on the service graph

The system SHALL preserve service status and service-to-service connections for observed traces, and SHALL animate service-to-service connections present in the selected trace.

#### Scenario: Show downstream calls from a triggered API

- **WHEN** a triggered mock API produces a trace with downstream service calls
- **THEN** the graph shows the participating services and their observed service-to-service connections
- **AND** the observed connections are animated

#### Scenario: Replay a saved trace

- **WHEN** a user replays a saved mock API call history entry
- **THEN** the graph highlights the services and animates the service-to-service connections from that saved trace
- **AND** the mock API is not triggered again
