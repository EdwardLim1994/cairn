# Spec Delta

## Purpose

Makes mock API execution readiness visible and prevents inactive or incomplete requests from being triggered while allowing users to preserve unfinished drafts.

## ADDED Requirements

### Requirement: Persist incomplete inactive drafts

The system SHALL allow named inactive mock API drafts to be saved without a matched endpoint or defined referenced variables. It SHALL preserve unresolved import method/URL metadata for later matching. Structurally unsafe data SHALL still be rejected, and draft state SHALL NOT create invalid graph connections.

#### Scenario: Reload an unmatched imported draft

- **WHEN** a user saves and reloads a draft whose endpoint could not be matched
- **THEN** the request remains available with its original method/URL metadata, headers, body, and missing configuration reasons
- **AND** no endpoint connection is shown until a valid endpoint is selected

### Requirement: Show activation and derived readiness

Each API card SHALL expose an Active switch governed by Save/Discard. Status SHALL be Draft for incomplete or invalid configuration, Inactive for valid configuration with the switch off, and Ready for valid configuration with the switch on. Reasons SHALL identify missing or invalid dependencies. Activation SHALL be allowed only for valid APIs.

#### Scenario: Activate a configured API

- **WHEN** a user enables a valid API and saves
- **THEN** its status is Ready and graph trigger controls allow execution

#### Scenario: Discard activation edit

- **WHEN** a user changes the Active switch and discards the panel
- **THEN** the saved activation state is restored

#### Scenario: Attempt activation with missing configuration

- **WHEN** a user attempts to enable an API with a missing endpoint, required path value, template, variable, or invalid effective header
- **THEN** the switch remains off and the card explains the blocking configuration

### Requirement: Automatically deactivate invalidated APIs

The system SHALL switch an API inactive when required configuration becomes missing or invalid. Staged changes SHALL stage the deactivation; saved dependency mutations SHALL persist affected deactivations. Restoring validity SHALL NOT automatically reactivate an API.

#### Scenario: Delete a variable in the panel

- **WHEN** a user stages deletion of a variable required by an active API
- **THEN** the draft API switches off and shows the missing variable
- **AND** Discard restores both saved variable and activation, while Save persists deletion and deactivation

#### Scenario: Restore a required variable

- **WHEN** a required variable is recreated after an API has become inactive
- **THEN** the API becomes valid but remains inactive until explicitly activated and saved

#### Scenario: Invalidate configuration through another supported API

- **WHEN** a saved variable is deleted or renamed, an endpoint is removed or changed, or a template change invalidates dependent APIs outside the current panel
- **THEN** affected saved APIs become inactive and their next read exposes current readiness reasons

### Requirement: Enforce readiness on the server

The server SHALL check saved activation, endpoint ownership and existence, required path values, effective headers, and referenced variables before issuing an outbound request. Client trigger controls SHALL reflect saved readiness and SHALL NOT replace server checks.

#### Scenario: Bypass a disabled trigger control

- **WHEN** a client calls the run endpoint directly for an inactive or invalid API
- **THEN** the server rejects the request with an actionable reason and sends no outbound call

#### Scenario: Unsaved activation does not permit execution

- **WHEN** a user turns on an API in an unsaved panel draft
- **THEN** the server continues to use saved activation and configuration until Save succeeds

### Requirement: Preserve existing valid APIs during migration

Existing valid APIs SHALL retain trigger availability after the upgrade. Existing incomplete APIs SHALL become inactive while preserving their saved request configuration and run history.

#### Scenario: Upgrade existing project data

- **WHEN** the new schema and readiness behavior are deployed
- **THEN** valid existing APIs remain executable and incomplete APIs expose Draft status without losing stored requests or past runs
