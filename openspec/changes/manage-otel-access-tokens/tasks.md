# Tasks

## 1. Token persistence and validation foundation

- [ ] 1.1 Add a project-scoped access-token table with unique token-digest and project indexes; generate and inspect the Drizzle migration, then verify it applies to the test MySQL database.
- [ ] 1.2 Implement secure token generation, digesting, expiry validation, and project-scoped repository/use-case operations; add unit tests for unique token generation, date boundaries, valid/expired tokens, and multiple simultaneously valid tokens.

## 2. Token management APIs

- [ ] 2.1 Add shared request/response schemas and list/create/delete APIs; verify invalid names/dates are rejected, list responses omit secrets and digests, and plaintext is returned only from creation.
- [ ] 2.2 Add MySQL-backed API integration tests for creation, list metadata, project scoping, confirmed deletion behavior, and unknown token IDs; verify a deleted token no longer validates.

## 3. Protect telemetry ingestion

- [ ] 3.1 Add shared bearer-token authentication to both OTLP routes before payload parsing; verify each accepts any matching unexpired token and returns 401 for missing, malformed, unknown, expired, or deleted tokens.
- [ ] 3.2 Extend telemetry route integration tests to prove rejected requests write no telemetry and that revoking one token leaves other valid tokens usable.

## 4. Access-token management dialog

- [ ] 4.1 Add an access-token action to the main page header and a Nuxt UI dialog with name, required expiry date, Generate action, and token metadata cards; verify the toolbar emits the open intent and the dialog renders list/create states.
- [ ] 4.2 Add one-time secret reveal and copy affordance, clear the secret when the dialog closes, and implement revoke warning with cancel/confirm; verify component tests cover copy visibility, cancel preserving a token, and confirm removing it.

## 5. Collector configuration and operator documentation

- [ ] 5.1 Configure the Collector exporter to send `Authorization: Bearer ...` from a Collector environment secret; validate the YAML with the Collector configuration validator when available and ensure no literal credential is committed.
- [ ] 5.2 Update README setup and rollout instructions for generating a Cairn token, configuring the Collector secret, token expiry/revocation, the trusted-operator assumption, and TLS on untrusted networks; verify the steps match the example configuration.

## 6. End-to-end change verification

- [ ] 6.1 Run focused server and component tests for access-token lifecycle, ingestion authentication, and dialog behavior; confirm all relevant tests pass.
- [ ] 6.2 Run `vp check` on changed source files and `openspec validate manage-otel-access-tokens --strict`; resolve any failures before implementation is considered ready.
