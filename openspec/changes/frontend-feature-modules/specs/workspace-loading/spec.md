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

### Requirement: Workspace presentation follows session and overlay state

The system SHALL render the login page alone while authentication is required and the operator is unauthenticated. After successful sign-in, the system SHALL render the workspace. When authentication is disabled, the toolbar SHALL hide Sign out. Workspace drawers SHALL open on the right. Observed timing labels SHALL sit near outbound connections, and the graph legend SHALL not overlap graph controls or the instruction overlay.

#### Scenario: Sign in and inspect the graph

- **WHEN** an unauthenticated operator signs in and opens the workspace
- **THEN** the workspace replaces the login page, drawers open on the right, timing appears near outbound connections, and the legend remains clear of graph controls and instructions

### Requirement: Template sections collapse independently

The system SHALL show shareable header templates and shareable authorization templates in separate accordions alongside the existing variable and mock API accordions.

#### Scenario: Collapse header templates

- **WHEN** the user collapses the header template section
- **THEN** header template cards are hidden while authorization template cards remain available

### Requirement: Drawers fit between the toolbar and viewport bottom

The system SHALL apply one shared drawer height and viewport gaps to all workspace drawers, including access tokens, service settings, and message queue settings.

#### Scenario: Open any drawer

- **WHEN** the user opens a drawer at desktop or narrow viewport size
- **THEN** its top stays below the toolbar and its bottom stays inside the viewport with a gap
