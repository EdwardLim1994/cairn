# Spec Delta

## Purpose

Defines how users register services with supported or custom framework metadata and how each service is represented in the graph.

## ADDED Requirements

### Requirement: Users can register services using the Other framework option

The system SHALL offer `Other` alongside Spring Boot and .NET when users add or edit a service. Selecting `Other` SHALL store the framework as `Other` without requiring a separate framework-name field.

#### Scenario: Register a service with Other framework

- **WHEN** a user selects `Other` and saves a valid service
- **THEN** the service is saved with the framework value `Other`
- **AND** its health-check configuration is available as defined by the service health-check capability

### Requirement: Other framework services use a name-based graph icon

The system SHALL display the first two characters of the service name as the graph icon for a service whose framework is `Other`.

#### Scenario: Display an Other service node

- **WHEN** the graph displays a service whose framework is `Other`
- **THEN** the service icon displays the first two characters of its name
- **AND** the Spring Boot and .NET framework icons remain unchanged
