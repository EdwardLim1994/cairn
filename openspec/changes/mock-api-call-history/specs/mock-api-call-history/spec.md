# Spec Delta

## Purpose

Lets users review past mock API calls, inspect saved request and response details, and replay each call's saved trace on the graph without calling the service again.

## ADDED Requirements

### Requirement: System records mock API call history

The system SHALL retain a project-scoped history entry for each triggered mock API call, including its trigger time, API identity, method, URL, outbound request snapshot, final status, and unique trace ID. History identity and request details SHALL remain available if the mock API is later changed or deleted.

#### Scenario: Record a triggered call

- **WHEN** a user triggers a mock API
- **THEN** the system records the API identity and call metadata with that call's trace ID
- **AND** the history status reflects running, completed, or failed state

#### Scenario: Preserve history after mock API changes

- **WHEN** a user renames, edits, or deletes a mock API after a call
- **THEN** the history entry retains the API identity and call metadata as they were when triggered

#### Scenario: Do not backfill older runs

- **WHEN** call history is introduced
- **THEN** the system records calls triggered after the feature is available
- **AND** it does not create incomplete history entries for older runs without request snapshots

### Requirement: Users can browse and inspect call history

The system SHALL provide a right-side panel with history entries ordered from newest to oldest. Each entry SHALL show trigger time, API name, method, URL, and status, and SHALL expand to show the saved request and response details.

#### Scenario: Open call history

- **WHEN** a user opens history from the main page header
- **THEN** the system displays saved mock API calls in reverse chronological order

#### Scenario: Inspect a saved call

- **WHEN** a user expands a history entry
- **THEN** the system displays that call's saved request and response details

### Requirement: Users can replay a saved trace

The system SHALL replay a history entry by loading its existing trace and highlighting its observed connections and service errors on the graph. Replaying a saved trace SHALL NOT trigger the mock API again.

#### Scenario: Replay a historical trace

- **WHEN** a user selects Replay on a history entry
- **THEN** the graph displays connections and service errors from that entry's trace ID
- **AND** the mock API endpoint receives no new request

#### Scenario: Restore history panel after replay

- **WHEN** a saved trace is replaying
- **THEN** the history panel moves mostly off-screen while leaving its restore control available at the upper-right
- **AND** selecting the restore control stops replay and shows the full panel

### Requirement: Users can remove call history

The system SHALL let users remove one history entry or clear all history entries in the current project. Removing history SHALL preserve linked run details, spans, and logs.

#### Scenario: Remove one history entry

- **WHEN** a user removes a history entry
- **THEN** the entry no longer appears in call history
- **AND** its linked run details, spans, and logs remain available

#### Scenario: Clear all history

- **WHEN** a user clears call history
- **THEN** all history entries for the current project are removed
- **AND** linked run details, spans, and logs remain available
