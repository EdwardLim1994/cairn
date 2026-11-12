# Spec Delta

## Purpose

Defines how Cairn Personal starts and retains its application and telemetry data without a separate database service.

## ADDED Requirements

### Requirement: First-run database initialization

Cairn SHALL create the application and telemetry database files and initialize their current schemas when it starts with an empty persistent data directory.

#### Scenario: Fresh installation

- **WHEN** Cairn starts with no database files in its configured data directory
- **THEN** it creates both files, initializes their schemas, and can serve application and telemetry requests

#### Scenario: Subsequent startup

- **WHEN** Cairn restarts with existing database files
- **THEN** it preserves their records and applies only pending schema migrations

### Requirement: Durable application state

Cairn SHALL persist project-scoped configuration, graph state, mock APIs, access tokens, runs, and call history in the application database across restarts.

#### Scenario: Restart retains a saved project

- **WHEN** a project has saved services, mock APIs, and run history and Cairn restarts
- **THEN** the same project can read those records after startup

### Requirement: Durable telemetry state

Cairn SHALL persist accepted spans and logs in the telemetry database across restarts, associated with their project and trace identifiers.

#### Scenario: Restart retains telemetry

- **WHEN** Cairn has accepted spans and logs for a project and restarts before their retention cutoff
- **THEN** the project's run flow and log views can read those records

### Requirement: Storage startup failure

Cairn SHALL report a startup failure when it cannot open or initialize either required database file.

#### Scenario: Unwritable data directory

- **WHEN** the configured persistent data directory cannot be written
- **THEN** Cairn fails startup with an actionable storage error instead of serving requests with incomplete persistence
