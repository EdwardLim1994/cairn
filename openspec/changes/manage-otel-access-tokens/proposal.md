# Proposal

## Why

Cairn currently accepts telemetry at its OTLP ingestion routes without authentication, so any client that can reach those routes can submit traces and logs. Operators need a way to create and revoke credentials for the Collector that forwards telemetry to Cairn.

## What Changes

- Add a trusted-operator access-token management dialog opened from the main page header.
- Generate named, expiring access tokens, reveal each token only once for copying into the Collector configuration, and list active token metadata without exposing token values again.
- Allow an operator to revoke a token after confirmation; revoking one token leaves other valid tokens usable.
- Require a matching, unexpired, non-revoked bearer token on both OTLP ingestion routes.
- Persist token metadata and token hashes in MySQL, and document Collector configuration for sending the bearer token to Cairn.
- Defer user login and authorization for the management UI and APIs. This change assumes Cairn is reachable only by trusted operators.

## Capabilities

### New Capabilities

- `otel-access-tokens`: Manage expiring access tokens and require any active token to authenticate telemetry ingestion.

### Modified Capabilities

None.

## Impact

- App header and a new access-token management dialog.
- Server APIs for listing, generating, and revoking tokens, plus authentication for `POST /v1/traces` and `POST /v1/logs`.
- Drizzle schema and MySQL migration for token metadata and hashed credentials.
- OpenTelemetry Collector configuration and README setup instructions.
- Unit and integration coverage for token lifecycle and protected ingestion routes.
