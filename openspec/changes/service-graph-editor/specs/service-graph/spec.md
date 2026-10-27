# Spec Delta

## Purpose

Lets users define services, endpoints, and call relationships in a visual graph, then save and reopen that graph.

## ADDED Requirements

### Requirement: Users can add service nodes

The system SHALL let users add a service node from the canvas context menu and register its name, framework, base URL, and available endpoints.

The framework SHALL be selected from the supported framework list, which initially includes Spring Boot and .NET. The system SHALL check each service's framework-specific health endpoint and show whether it is online.

#### Scenario: Add a service from the canvas

- **WHEN** a user opens the canvas context menu and selects Add node
- **THEN** the system shows a form for service name, framework, base URL, and available endpoints

#### Scenario: Create a service with endpoints

- **WHEN** a user submits a valid service form
- **THEN** the system adds the service and its registered endpoints to the graph

#### Scenario: Show service health

- **WHEN** a service health check succeeds or fails
- **THEN** the node displays Online or Offline based on the health endpoint response
- **AND** the system refreshes health status periodically

### Requirement: Users can register service endpoints

The system SHALL let users register each endpoint with a name, API type, method, and manually entered URL.

#### Scenario: Register an endpoint

- **WHEN** a user adds an endpoint and saves the service
- **THEN** the system stores the endpoint name, API type, method, and URL, and displays the endpoint name and method on its service node

#### Scenario: Endpoint URL is entered manually

- **WHEN** a user registers or edits an endpoint
- **THEN** the system lets the user enter its URL manually

### Requirement: Users can edit service settings

The system SHALL let users edit a service's name, framework, base URL, active status, and registered endpoints.

#### Scenario: Save service edits

- **WHEN** a user saves changed service settings
- **THEN** the system updates the service node and its endpoint rows in the graph

#### Scenario: Discard service edits

- **WHEN** a user discards unsaved service settings
- **THEN** the system restores the last saved service values

### Requirement: Users can connect graph nodes to service endpoints

The system SHALL let users connect a service node or an individual mock API row to a specific registered service endpoint.

#### Scenario: Connect a mock API row to an endpoint

- **WHEN** a user selects a service endpoint for a mock API row
- **THEN** the graph displays the connection to that specific endpoint

#### Scenario: Connect services

- **WHEN** a user connects one service node to a registered endpoint on another service
- **THEN** the graph displays the declared service call relationship

### Requirement: Users can save the graph

The system SHALL save the current graph so users can restore service nodes, the shared Mock APIs node and its entries, registered endpoints, connections, and positions.

#### Scenario: Save and restore graph state

- **WHEN** a user saves the graph and later opens it
- **THEN** the system restores the saved service nodes, Mock APIs node and entries, endpoints, connections, and positions
