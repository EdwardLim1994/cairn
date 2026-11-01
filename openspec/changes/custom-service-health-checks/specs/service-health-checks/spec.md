# Spec Delta

## Purpose

Defines how Cairn configures and runs health checks for registered services, including authenticated checks for services using the Other framework option.

## ADDED Requirements

### Requirement: Users can configure health checks for Other services

When a user selects `Other` as a service framework, the system SHALL show a health-check URL field and optional header configuration. The URL SHALL accept either an absolute HTTP or HTTPS URL or a relative path resolved against the service base URL. Header configuration SHALL reuse project-wide header templates and support service-specific custom headers, with custom values overriding template values of the same name. The URL guidance SHALL state that only GET requests are allowed.

#### Scenario: Configure a custom service health check

- **WHEN** a user selects `Other` while adding or editing a service
- **THEN** the service form shows the health-check URL, header-template, and custom-header fields
- **AND** the health-check URL field indicates that only GET requests are allowed

#### Scenario: Resolve a relative health-check URL

- **WHEN** a saved `Other` service has a relative health-check path
- **THEN** the system resolves that path against the service base URL

#### Scenario: Use an absolute health-check URL

- **WHEN** a saved `Other` service has an absolute HTTP or HTTPS health-check URL
- **THEN** the system sends the check to that URL

### Requirement: The system checks custom services with GET and configured headers

The system SHALL issue a GET request to the configured health-check URL for an `Other` service. It SHALL resolve header-template and custom-header values using the project's shared environment variables and existing header merge rules. The service SHALL be Online when the response is successful and Offline when the response is unsuccessful, the request fails, or no custom health-check URL is configured.

#### Scenario: Health check succeeds with a shared header template

- **WHEN** the configured GET health check returns a successful response using resolved template headers
- **THEN** the service is shown as Online

#### Scenario: A custom header overrides a template header

- **WHEN** a service custom header has the same name as a header from its selected template
- **THEN** the health-check request uses the custom header value

#### Scenario: Health check fails

- **WHEN** the GET request fails or returns an unsuccessful response
- **THEN** the service is shown as Offline

#### Scenario: Other service has no health-check URL

- **WHEN** an `Other` service has no configured health-check URL
- **THEN** the service is shown as Offline

### Requirement: Built-in framework health checks continue to work

The system SHALL continue checking Spring Boot services at `/actuator/health` and .NET services at `/health` using GET requests.

#### Scenario: Check a Spring Boot service

- **WHEN** the system checks a Spring Boot service
- **THEN** it sends a GET request to the service base URL plus `/actuator/health`

#### Scenario: Check a .NET service

- **WHEN** the system checks a .NET service
- **THEN** it sends a GET request to the service base URL plus `/health`
