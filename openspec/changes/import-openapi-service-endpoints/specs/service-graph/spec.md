# Spec Delta

## Purpose

Lets users register and manage microservice endpoints in a visual service graph, including importing supported REST operations from an OpenAPI document.

## ADDED Requirements

### Requirement: Import endpoints from an OpenAPI document

The system SHALL let users upload a JSON or YAML OpenAPI document from service settings and add its supported operations as REST endpoints in the current service draft without changing the service base URL.

#### Scenario: Import supported operations

- **WHEN** a user uploads a valid OpenAPI document containing supported operations
- **THEN** the system adds those operations to the service draft as REST endpoints
- **AND** uses each operation's summary, then operationId, then method and path as its endpoint name
- **AND** retains the service's current base URL

#### Scenario: Save imported endpoints with service settings

- **WHEN** a user imports endpoints and saves the service settings
- **THEN** the imported endpoints are saved with the service

#### Scenario: Replace the untouched starter endpoint on a new service

- **WHEN** a user imports at least one operation into a new service draft with its untouched blank starter endpoint
- **THEN** the system removes that blank starter endpoint and adds the imported endpoints
- **AND** preserves any other endpoint drafts

#### Scenario: Reject an invalid document

- **WHEN** a user uploads a document that the OpenAPI parser cannot parse or validate
- **THEN** the system displays an error and leaves the service draft endpoints unchanged

### Requirement: Skip duplicate OpenAPI operations

The system SHALL identify a duplicate endpoint by its HTTP method and normalized path, skip the imported operation, preserve the existing endpoint and its connections, and show a warning toast for each duplicate.

#### Scenario: Skip an operation matching an existing endpoint

- **WHEN** an imported operation has the same HTTP method and normalized path as an endpoint already registered for the service
- **THEN** the system does not add or modify that endpoint
- **AND** preserves its existing name and connections
- **AND** shows a warning toast identifying the duplicate operation

### Requirement: Skip unsupported OpenAPI methods

The system SHALL import only GET, POST, PUT, PATCH, and DELETE operations, and show a warning toast for each operation using another HTTP method.

#### Scenario: Skip an unsupported method

- **WHEN** an OpenAPI document contains an operation using a method other than GET, POST, PUT, PATCH, or DELETE
- **THEN** the system skips that operation
- **AND** shows a warning toast identifying the unsupported operation
