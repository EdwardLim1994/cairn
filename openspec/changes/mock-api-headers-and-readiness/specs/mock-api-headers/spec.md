# Spec Delta

## Purpose

Allows users to configure reusable project header templates and per-API custom headers for outbound mock API requests.

## ADDED Requirements

### Requirement: Manage named header templates

The system SHALL provide named project-scoped template cards in the Mock APIs panel, each with an editable header name/value table and row add/remove actions. New cards SHALL open in edit mode. Template creation, edits, and deletion SHALL participate in Save/Discard.

#### Scenario: Save or discard a template

- **WHEN** a user adds or edits a template card and header rows
- **THEN** Save persists the template and Discard restores the last saved templates

#### Scenario: Isolate templates by project

- **WHEN** an API selects or modifies a template from another project
- **THEN** the system rejects the operation and does not expose that template's values

### Requirement: Combine one template with custom headers

Each mock API SHALL support zero or one template and a custom header table below its URL display. Custom headers SHALL override matching template headers case-insensitively. Duplicate names within one table SHALL be rejected case-insensitively. Selecting a template SHALL include every template header, with no per-header disable control.

#### Scenario: Override a template value

- **WHEN** a selected template defines `X-Tenant-ID` and the API defines custom `x-tenant-id`
- **THEN** the outbound request contains one effective header using the custom value

#### Scenario: Use a subset of template headers

- **WHEN** a user needs only a subset of a template's headers
- **THEN** the user must select or create a different template or use custom headers without a template

#### Scenario: Empty value is retained

- **WHEN** a custom header has a valid name and an empty value
- **THEN** the system treats it as an empty header value rather than a request to omit the template header

#### Scenario: Template changes propagate

- **WHEN** a user saves a change to a template
- **THEN** subsequent runs of referencing APIs use the updated template subject to custom overrides

### Requirement: Resolve and validate effective request headers

The system SHALL preserve header value templates and resolve project string variables at execution. Missing variables or invalid effective headers SHALL prevent outbound calls. Names SHALL be valid HTTP header names; values SHALL reject carriage return and newline characters. Users SHALL NOT override Cairn-generated `traceparent`.

#### Scenario: Reuse a variable in authorization

- **WHEN** a header value is `Bearer {{token}}` and `token` exists in the current project
- **THEN** the request uses the current variable value without changing the saved template text

#### Scenario: Missing variable or invalid resolved value

- **WHEN** an effective header references an undefined variable or resolves to a value containing a newline
- **THEN** the API is not ready and no outbound request is sent
- **AND** the displayed reason identifies the header or variable without revealing header values

#### Scenario: Preserve default content type and tracing

- **WHEN** a valid API runs with custom headers
- **THEN** Cairn generates `traceparent`, retains its existing JSON content type default when no explicit content type is supplied, and applies valid user headers to GET and non-GET calls

### Requirement: Confirm template deletion and detach referencing APIs

Deleting a template SHALL show a confirmation dialog identifying affected APIs. Confirm SHALL detach those APIs and delete the template as one saved operation while preserving custom headers. Cancel SHALL leave state unchanged. Confirmed deletion SHALL remain staged until panel Save.

#### Scenario: Confirm deletion of a template in use

- **WHEN** a user confirms deletion and saves the panel
- **THEN** all referencing APIs in the project are detached and the template is deleted together
- **AND** custom headers remain and affected APIs are revalidated

#### Scenario: Cancel or discard deletion

- **WHEN** a user cancels the confirmation or discards the panel after confirming
- **THEN** saved template associations, template rows, and API activation states remain unchanged
