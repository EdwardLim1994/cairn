# Spec Delta

## Purpose

Lets users register GraphQL services as a single server endpoint in the service graph, separate from REST operation endpoints.

## ADDED Requirements

### Requirement: Register a GraphQL service endpoint

The system SHALL let users choose GraphQL as a service API type and register exactly one endpoint for that GraphQL server.

#### Scenario: Configure a GraphQL service

- **WHEN** a user selects GraphQL for a service
- **THEN** service settings show one GraphQL endpoint URL field
- **AND** hide OpenAPI import and endpoint add/remove controls

#### Scenario: Save a GraphQL service

- **WHEN** a user saves a GraphQL service
- **THEN** the system stores one GraphQL endpoint associated with that service
- **AND** makes that endpoint available to GraphQL mock APIs

#### Scenario: Reject multiple GraphQL endpoints

- **WHEN** a GraphQL service is submitted with zero or multiple endpoints
- **THEN** the system rejects the service and reports that exactly one endpoint is required
