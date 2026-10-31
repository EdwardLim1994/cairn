# Spec Delta

## Purpose

Supports separate Postman collection and environment imports into editable mock API and variable drafts without requiring a particular import order or overwriting existing variables.

## ADDED Requirements

### Requirement: Import request headers without implicit sharing

Collection import SHALL copy enabled explicit request headers into each imported API's custom header rows, preserve variable placeholders, select no header template, and default activation off. Disabled rows SHALL be omitted. Unsupported authorization, scripts, invalid headers, and protected headers SHALL produce request-specific warnings rather than silent loss.

#### Scenario: Import enabled and disabled header rows

- **WHEN** a matching collection request contains an enabled authorization header using `{{token}}` and a disabled header row
- **THEN** its inactive API draft contains the authorization placeholder as a custom header and omits the disabled row
- **AND** no shared header template is created or selected

#### Scenario: Request relies on unsupported authorization or scripts

- **WHEN** a request or its inherited collection/folder context specifies unsupported authorization configuration or scripts
- **THEN** import identifies the affected request and warns that the generated behavior is not reproduced
- **AND** the system does not execute imported scripts or claim their generated values are available

### Requirement: Import environment variables separately

The environment section SHALL provide its own import action for Postman environment JSON. Enabled entries with valid Cairn names and supported scalar values SHALL become string variable drafts. Empty strings SHALL be preserved. Collection import SHALL NOT automatically create Cairn variables, and environment import SHALL NOT create API drafts.

#### Scenario: Import environment before APIs

- **WHEN** a user imports an environment with new valid variable names
- **THEN** editable variable cards appear and are available to draft validation and later collection URL matching before Save

#### Scenario: Skip duplicate or invalid entries

- **WHEN** an environment entry duplicates a saved or staged variable name, or an earlier accepted name in the same file
- **THEN** that entry is skipped with a name-specific warning regardless of whether the values match
- **AND** existing values are not overwritten

#### Scenario: Convert supported values and report unsupported entries

- **WHEN** an environment file includes numeric, boolean, empty string, disabled, invalid-name, null, or structured values
- **THEN** numbers and booleans become strings, empty strings remain empty, disabled entries are omitted, and invalid-name/null/structured entries are skipped with warnings

#### Scenario: Reject an invalid environment document

- **WHEN** the selected file is not valid Postman environment JSON
- **THEN** import reports an error without changing variable or API drafts

### Requirement: Diagnose variable references regardless of import order

API import SHALL identify undefined Cairn references in path parameters, headers, JSON string values, and unresolved source URLs. Warnings SHALL identify API and variable names without exposing values. Missing references SHALL NOT prevent draft creation or Save. Import and later draft edits SHALL re-evaluate current variable cards, including unsaved cards.

#### Scenario: Import APIs before environment

- **WHEN** a collection request references an undefined `token`
- **THEN** its inactive draft is retained with a missing-variable warning and can be saved
- **AND** importing or creating `token` clears the readiness issue without automatically activating the API

#### Scenario: Existing variables are sufficient

- **WHEN** all referenced variables exist in saved or staged cards
- **THEN** the importer does not report those variables as missing

### Requirement: Retain unmatched requests for later endpoint selection

The importer SHALL retain otherwise supported requests that cannot match registered REST endpoints as inactive drafts with matching diagnostics. It SHALL preserve method/URL information, retry unresolved matches when variables change, and support manual endpoint selection. Matching SHALL continue to respect method and normalized full URL, including route parameters.

#### Scenario: Missing base URL prevents matching

- **WHEN** a request URL is `{{base_url}}/orders` and no matching value exists
- **THEN** the request remains an unmatched inactive draft rather than being skipped
- **AND** a later environment import can resolve the URL and match it without reimporting the collection

#### Scenario: Manual selection or method mismatch

- **WHEN** automatic matching fails or the method differs from registered endpoints
- **THEN** the draft explains the mismatch and offers manual endpoint selection
- **AND** selection explicitly uses the registered endpoint's method and route for execution

#### Scenario: Use collection variables only for matching

- **WHEN** collection variables supply values needed for endpoint URL matching
- **THEN** those values remain usable for matching without creating environment cards or resolving saved header/body placeholders to literal values

### Requirement: Preserve import Save and Discard semantics

Both import actions SHALL create staged edits. Save SHALL persist accepted variables, template associations, headers, import metadata, and inactive drafts. Discard SHALL restore saved state. Invalid collection documents SHALL remain import errors, and unsupported non-JSON request bodies SHALL retain the existing skip-with-warning behavior.

#### Scenario: Discard both import types

- **WHEN** a user imports APIs and environment variables and then discards the panel
- **THEN** neither imported API drafts nor new variable cards are persisted

#### Scenario: Save and reload both import types

- **WHEN** a user saves imported variables and API drafts and reloads the panel
- **THEN** all accepted values and unresolved diagnostics can be restored without reimporting either file
