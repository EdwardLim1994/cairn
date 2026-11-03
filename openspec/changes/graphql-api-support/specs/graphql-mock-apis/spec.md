# Spec Delta

## Purpose

Lets users create and run GraphQL requests against the single endpoint registered by a GraphQL service, with syntax checking and JSON variables.

## ADDED Requirements

### Requirement: Create GraphQL mock APIs explicitly

The system SHALL let users choose GraphQL when creating a mock API and SHALL restrict its target to a registered GraphQL endpoint.

#### Scenario: Create a GraphQL mock API

- **WHEN** a user creates a GraphQL mock API
- **THEN** only registered GraphQL endpoints are available as targets
- **AND** REST endpoints are unavailable

#### Scenario: Keep Postman collection imports HTTP-only

- **WHEN** a user imports a Postman collection
- **THEN** the importer creates only HTTP mock API drafts
- **AND** it does not create GraphQL mock APIs

### Requirement: Edit a GraphQL request

The system SHALL let users enter a GraphQL operation and JSON variables for a GraphQL mock API.

#### Scenario: Edit query and variables

- **WHEN** a user edits a GraphQL mock API
- **THEN** the system provides a GraphQL query editor and a JSON variables editor
- **AND** checks GraphQL syntax without requiring a GraphQL schema

#### Scenario: Reject invalid GraphQL syntax on run

- **WHEN** a GraphQL request contains a syntax error
- **THEN** the system prevents the request from running
- **AND** identifies the syntax error in the query editor

### Requirement: Run a GraphQL request

The system SHALL send a valid GraphQL query or mutation and its variables to the selected GraphQL endpoint and display the response.

#### Scenario: Run a successful GraphQL request

- **WHEN** a user runs a ready GraphQL mock API and the endpoint returns a successful HTTP response
- **THEN** the system displays the GraphQL response and HTTP status
- **AND** records the run in existing call history with trace correlation

#### Scenario: Display GraphQL errors in a successful HTTP response

- **WHEN** a successful HTTP response contains GraphQL errors
- **THEN** the system displays the full GraphQL response, including its errors
- **AND** records the HTTP run as completed

#### Scenario: Handle an HTTP or connection failure

- **WHEN** the GraphQL endpoint returns a non-success HTTP status or cannot be reached
- **THEN** the system marks the run failed
- **AND** displays and records the failure details
