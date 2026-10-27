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

#### Scenario: Show the running entry

- **WHEN** a mock API entry is running
- **THEN** the system visually marks that entry and its endpoint connection as active
