# Spec Delta

## Purpose

Lets users create and run unary gRPC mock API calls from registered service endpoints while reusing the service's uploaded proto schema.

## ADDED Requirements

### Requirement: Create gRPC mock APIs explicitly

The system SHALL let users choose a mock API type and SHALL restrict each mock API to endpoints with the same type.

#### Scenario: Create a gRPC mock API

- **WHEN** a user chooses gRPC while creating a mock API
- **THEN** the user can select a registered gRPC endpoint
- **AND** REST endpoints are unavailable in the target selector

#### Scenario: Create an HTTP mock API

- **WHEN** a user creates an HTTP mock API
- **THEN** only REST endpoints are available in its target selector

#### Scenario: Keep Postman import HTTP-only

- **WHEN** a user imports a Postman collection
- **THEN** the importer creates drafts only for matching REST endpoints
- **AND** gRPC mock APIs remain explicitly created by the user

### Requirement: Configure a unary gRPC request

The system SHALL let users enter a JSON request message for a gRPC mock API targeting a unary endpoint.

#### Scenario: Edit a gRPC request message

- **WHEN** a user edits a gRPC mock API
- **THEN** the system provides a JSON request message editor
- **AND** validates the message against the selected endpoint's request type before invoking it

### Requirement: Run a unary gRPC mock API

The system SHALL invoke the selected unary method using its service target, TLS setting, and stored proto schema.

#### Scenario: Run a successful unary call

- **WHEN** a user runs a ready gRPC mock API and the target returns a response
- **THEN** the system displays the response message and gRPC status
- **AND** records the run using existing call history and trace correlation

#### Scenario: Run a failed unary call

- **WHEN** a gRPC call fails or returns a non-OK status
- **THEN** the system marks the run failed
- **AND** records the gRPC status and error details in the run result

#### Scenario: Use the service proto file

- **WHEN** a gRPC mock API runs
- **THEN** the system loads the proto file associated with its selected endpoint's service
- **AND** invokes the selected method described by that file
