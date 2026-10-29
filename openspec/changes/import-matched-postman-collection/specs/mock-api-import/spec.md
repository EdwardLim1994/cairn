# Spec Delta

## Purpose

Lets users reuse requests from Postman collections as mock API drafts while ensuring each imported draft targets an endpoint already registered in the service graph.

## ADDED Requirements

### Requirement: Users can import matching Postman requests

The system SHALL let users select a Postman collection JSON file from Mock API settings and create a REST mock API draft for each request that matches a registered service endpoint by full URL and HTTP method. Each draft SHALL link to the matched endpoint and use the Postman request name and JSON body.

#### Scenario: Import requests that match registered endpoints

- **WHEN** a user imports a valid Postman collection containing requests that match registered endpoints by full URL and method
- **THEN** the system adds those requests as editable mock API drafts linked to the matching endpoints
- **AND** each draft is treated as a REST API and uses the request name and JSON body from Postman

#### Scenario: Match Postman path variables to route parameters

- **WHEN** a Postman URL has a variable path segment and the registered endpoint has a route parameter in that segment, with the service URL and HTTP method matching
- **THEN** the system treats the request as matching that endpoint

#### Scenario: Skip requests that do not match

- **WHEN** a Postman request has no registered endpoint with a matching normalized URL and HTTP method
- **THEN** the system does not create a mock API draft for that request

### Requirement: Warn about unmatched Postman requests

The system SHALL show a distinct warning toast for each Postman request skipped because its URL or HTTP method does not match an available endpoint.

#### Scenario: Show one warning for each unmatched request

- **WHEN** an imported collection contains one or more requests without a matching endpoint
- **THEN** the system shows a separate warning toast for each unmatched request
- **AND** each warning identifies the skipped request by name and indicates the URL or method mismatch

#### Scenario: Reject an invalid collection file

- **WHEN** the selected file is not a valid Postman collection JSON document
- **THEN** the system reports an import error and does not add drafts from that file
