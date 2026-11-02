# Spec Delta

## Purpose

This capability lets a trusted Cairn operator create and revoke credentials for the OpenTelemetry Collector and ensures only valid credentials can submit telemetry to Cairn.

## ADDED Requirements

### Requirement: Generate expiring access tokens

Cairn SHALL let an operator generate a named access token with a required expiration date.

#### Scenario: Generate a token

- **WHEN** an operator submits a non-empty name and a valid future expiration date
- **THEN** Cairn creates a unique access token and returns its secret value for copying

#### Scenario: Reject invalid token details

- **WHEN** an operator submits an empty name, an invalid expiration date, or a date that is not in the future
- **THEN** Cairn rejects the request and creates no token

### Requirement: Reveal token secrets only once

Cairn SHALL show a generated token secret only in the successful generation response and SHALL NOT return it from token listing or subsequent reads.

#### Scenario: List managed tokens

- **WHEN** an operator opens token management
- **THEN** Cairn lists each non-revoked token's name and expiration date without its secret value, and identifies expired tokens as expired

#### Scenario: Read a generated token again

- **WHEN** an operator requests token metadata after generation
- **THEN** Cairn returns metadata only and does not reveal the token secret

### Requirement: Revoke an access token

Cairn SHALL require operator confirmation before revoking a token and SHALL make a revoked token unusable.

#### Scenario: Confirm revocation

- **WHEN** an operator confirms the revoke warning for a listed token
- **THEN** Cairn revokes that token and removes it from the active token list

#### Scenario: Cancel revocation

- **WHEN** an operator dismisses the revoke warning
- **THEN** Cairn leaves the token valid and listed

### Requirement: Accept every active unexpired access token

Cairn SHALL accept any presented token that matches a stored token, has not been revoked, and has not expired.

#### Scenario: Multiple tokens remain valid

- **WHEN** more than one token is active and unexpired
- **THEN** each token independently authenticates telemetry ingestion

#### Scenario: Expired or revoked token is presented

- **WHEN** a token has expired or been revoked
- **THEN** Cairn rejects it even if other tokens remain active

### Requirement: Authenticate telemetry ingestion

Cairn SHALL require a valid bearer access token on both OTLP telemetry ingestion routes before accepting or persisting request data.

#### Scenario: Valid bearer token

- **WHEN** a request to `POST /v1/traces` or `POST /v1/logs` includes any active unexpired bearer token
- **THEN** Cairn processes the OTLP payload using the existing ingestion behavior

#### Scenario: Missing or invalid bearer token

- **WHEN** a request to either telemetry ingestion route has no bearer token or has an unknown, expired, or revoked token
- **THEN** Cairn returns HTTP 401 and does not persist telemetry from the request
