# Spec Delta

## Purpose

Lets users define reusable mock API call nodes, run calls against registered service endpoints, and inspect returned results.

## ADDED Requirements

### Requirement: Users can manage mock API entries

The system SHALL let users add, edit, and remove named mock API entries in one shared Mock APIs graph node, with a selected service endpoint, JSON request value, and description.

#### Scenario: Add a mock API entry

- **WHEN** a user adds a mock API entry and selects a registered service endpoint
- **THEN** the system displays the entry as a row in the shared Mock APIs node and connects that row to the selected endpoint

#### Scenario: Configure a mock API request

- **WHEN** a user enters a JSON request for a mock API entry
- **THEN** the system saves that JSON value on the mock API entry without requiring a fixed request schema

#### Scenario: Save or discard mock API edits

- **WHEN** a user saves or discards changes in Mock API settings
- **THEN** the system saves the edited entries or restores their last saved values

#### Scenario: Remove a mock API entry

- **WHEN** a user removes an entry and saves the changes
- **THEN** the system removes that row and its endpoint connection

### Requirement: Users can configure endpoint path parameters per mock API

The system SHALL let users save values for route parameters declared by the selected endpoint. Values SHALL be stored on the mock API entry, kept when the canvas is reloaded, and substituted into the endpoint path when the mock API runs.

#### Scenario: Save a literal route parameter value

- **WHEN** a user configures a mock API for an endpoint such as `/payments/{orderId:guid}` and enters a concrete `orderId`
- **THEN** the system saves that value with the mock API
- **AND** a run sends the concrete value in the corresponding URL path segment

#### Scenario: Import a Postman path value

- **WHEN** an imported Postman request matches an endpoint with route parameters
- **THEN** the system copies concrete request path segments into the corresponding mock API path parameter values
- **AND** it preserves unresolved Postman variable references for resolution through the shared environment variables

### Requirement: Users can manage one shared set of environment variables

The system SHALL let users create, edit, and remove named string values in one environment variable set shared by all mock APIs in the current project. The settings panel SHALL present each saved variable as a card showing its name and value.

#### Scenario: Reuse a shared variable

- **WHEN** a user references an environment variable from a mock API path parameter or JSON request template
- **THEN** the system resolves it from the current project's shared variable set when the API is triggered
- **AND** the string value replaces the placeholder wherever it appears in the request

#### Scenario: Report an undefined variable

- **WHEN** a mock API references a variable that is not defined in the current project
- **THEN** the system marks the run as failed with a clear variable name in the error
- **AND** the system does not send the outbound request

### Requirement: Users can edit JSON request templates in a structured editor

The system SHALL provide a JSON-aware editor for mock API request values with indentation, syntax highlighting, formatting, validation, and autocomplete for shared environment variables. Variable references SHALL be valid JSON strings in the editor and SHALL resolve to string values.

#### Scenario: Format and validate a request template

- **WHEN** a user formats or edits a request template
- **THEN** the editor indents and highlights JSON and reports syntax errors before the mock API is saved or triggered
- **AND** it recognizes variable placeholders inside JSON strings during validation

#### Scenario: Complete an environment variable reference

- **WHEN** a user enters a variable placeholder in the request editor
- **THEN** the editor offers names from the current project's shared variable set as completions

### Requirement: Users can trigger a mock API call

The system SHALL send the selected service endpoint's method and URL with the mock API entry's JSON request when a user triggers it.

#### Scenario: Call succeeds

- **WHEN** the target endpoint returns a response
- **THEN** the system records and presents the actual response for that run

#### Scenario: Call fails

- **WHEN** the target endpoint cannot be reached or returns an error
- **THEN** the system records the failure and makes the failed run available for inspection
- **AND** the system adds an error log linked to the run and marks the selected service as failed
- **AND** the error message includes the target response body when one is returned, and the logs panel displays the full message

### Requirement: Users can inspect run status

The system SHALL show whether a triggered mock API call is running, completed, or failed.

#### Scenario: Run completes

- **WHEN** the target endpoint returns a response
- **THEN** the run status becomes completed and the response is available

#### Scenario: Run fails

- **WHEN** the target endpoint call fails
- **THEN** the run status becomes failed and the failure is available

#### Scenario: Highlight a completed request flow

- **WHEN** a mock API call finishes and its trace includes downstream service calls
- **THEN** the graph highlights the mock API connection and every service connection in the trace
- **AND** the mock API node and every participating service node have highlighted borders

#### Scenario: Show the running entry

- **WHEN** a mock API entry is running
- **THEN** the system visually marks that entry and its endpoint connection as active
