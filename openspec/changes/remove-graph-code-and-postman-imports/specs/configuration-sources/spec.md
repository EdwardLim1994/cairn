# Spec Delta

## Purpose

Defines the supported ways to configure Cairn Personal after removing Graph as Code and Postman import shortcuts.

## ADDED Requirements

### Requirement: In-app graph configuration

Cairn SHALL let users create and edit services, endpoints, graph connections, and message destinations through the app without a Graph as Code editor or manifest import.

#### Scenario: Configure a graph manually

- **WHEN** a user opens a project graph
- **THEN** the app offers its existing controls to create and edit graph entities and connections without a Graph as Code action

### Requirement: No Graph as Code API

Cairn SHALL no longer accept graph manifests through the Graph as Code API endpoint.

#### Scenario: Legacy endpoint request

- **WHEN** a client requests the removed Graph as Code endpoint
- **THEN** Cairn does not apply the manifest or change project graph data

### Requirement: In-app mock API configuration

Cairn SHALL let users create and edit mock APIs, custom headers, shared variables, and authorization templates in the Mock APIs panel without Postman collection or environment import controls.

#### Scenario: Configure a mock API manually

- **WHEN** a user opens the Mock APIs panel
- **THEN** the app offers manual creation and editing for mock APIs and shared settings without Postman import actions

### Requirement: Service definition inputs remain available

Cairn SHALL retain OpenAPI endpoint import and `.proto` upload in service settings.

#### Scenario: Configure service endpoints

- **WHEN** a user edits a REST or gRPC service
- **THEN** the service settings retain the OpenAPI import or `.proto` upload applicable to that service

### Requirement: Import-only identifiers are not required

Cairn SHALL use record IDs to preserve ordinary graph and mock API relationships without requiring Graph as Code keys or Postman import metadata in application requests.

#### Scenario: Save manually configured canvas

- **WHEN** a user saves a manually configured canvas
- **THEN** service, endpoint, message destination, and mock API relationships remain intact without import-only keys or metadata
