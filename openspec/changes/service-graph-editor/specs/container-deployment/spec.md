# Spec Delta

## Purpose

Provides a repeatable container deployment for the application and MySQL, with runtime configuration that works in local development and Docker.

## ADDED Requirements

### Requirement: App and MySQL run through Docker Compose

The repository SHALL provide a Dockerfile for the production app image and a Docker Compose file that runs the app with MySQL.

#### Scenario: Start the app stack

- **WHEN** an operator starts the Compose project
- **THEN** Compose builds and starts the app and MySQL, waits for MySQL health before starting the app, and publishes the configured app port

#### Scenario: Preserve database data

- **WHEN** the MySQL container is recreated
- **THEN** saved graph and telemetry data remain in persistent storage

### Requirement: App uses runtime environment configuration

The app SHALL accept `DATABASE_URL`, `OTEL_COLLECTOR_URL`, `PROJECT_ID`, and `PORT` at runtime without baking deployment values into the image.

#### Scenario: Configure application services

- **WHEN** the app starts with runtime environment values
- **THEN** it uses `DATABASE_URL` for MySQL, `OTEL_COLLECTOR_URL` as its OpenTelemetry exporter endpoint, `PROJECT_ID` to scope graph and telemetry data, and `PORT` as its listening port

#### Scenario: Isolate project data

- **WHEN** the app reads or writes graph, run, trace, or log data
- **THEN** it uses the configured project ID, with one saved canvas per project ID

### Requirement: Local and Compose environment values have a safe template

The repository SHALL provide a tracked `.env.example` for application and Compose settings, while local `.env` files remain untracked.

#### Scenario: Configure a local environment

- **WHEN** an operator copies `.env.example` to `.env` and fills in local values
- **THEN** the app and Compose project can read the required configuration from `.env`

#### Scenario: Keep local credentials out of source control

- **WHEN** an operator sets database credentials in `.env`
- **THEN** the repository excludes `.env` from version control and the example contains placeholders instead of real credentials

### Requirement: Container startup applies pending database migrations

The production app image SHALL include a migration runner and the checked-in Drizzle migrations. Each container startup SHALL apply pending migrations before starting the web server, using the runtime `DATABASE_URL`.

#### Scenario: Initialize a fresh database

- **WHEN** the app starts after MySQL is healthy with an empty database
- **THEN** it applies all checked-in migrations before serving requests

#### Scenario: Restart with an up-to-date database

- **WHEN** the app restarts with all checked-in migrations already recorded
- **THEN** it skips those migrations and starts the server without changing the schema

#### Scenario: Deploy a new schema migration

- **WHEN** a rebuilt image includes a new migration
- **THEN** startup applies only pending migrations and retains existing data according to their SQL

#### Scenario: Migration fails

- **WHEN** database connection or migration execution fails
- **THEN** the container exits with a nonzero status without starting the web server
