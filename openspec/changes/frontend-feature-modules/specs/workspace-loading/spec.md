# Spec Delta

## Purpose

Keeps the graph usable on entry while deferring closed workspace panels until users request them.

## ADDED Requirements

### Requirement: Initial workspace contains graph and toolbar

The system SHALL make the toolbar, graph canvas, and all graph node types available during initial workspace loading.

#### Scenario: Open workspace

- **WHEN** a user enters the workspace
- **THEN** the toolbar and populated graph render from the initial canvas data without opening a side panel

### Requirement: Full initial canvas data

The system SHALL load complete service, message destination, mock API, connection, and template data for the initial graph and later panel views.

#### Scenario: Open a panel after initial load

- **WHEN** a user opens a panel after the workspace finishes loading
- **THEN** its cards use current workspace data without requiring a second base-data request

### Requirement: Closed panels load on demand

The system SHALL defer panel UI and panel-only data work until the user opens the panel.

#### Scenario: Initial workspace load

- **WHEN** a user enters the workspace without opening logs, history, or a side panel
- **THEN** those panel views remain closed and panel-only fetching does not run

#### Scenario: Open deferred panel

- **WHEN** a user opens a deferred panel
- **THEN** its UI loads and its panel-only data becomes available

### Requirement: Graph data remains current after mutation

The system SHALL refresh canonical workspace data after an entity mutation before reporting full success.

#### Scenario: Update service

- **WHEN** a service update and workspace refresh succeed
- **THEN** graph nodes and service cards show the refreshed service data
