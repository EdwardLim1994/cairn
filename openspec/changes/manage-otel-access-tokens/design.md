# Design

## Context

The current Collector exports OTLP/HTTP JSON to Cairn's `/v1/traces` and `/v1/logs` routes without authentication. The Collector is deployed separately, while Cairn uses MySQL and a single configured `PROJECT_ID`. The main page toolbar is a focused component and the project already uses Nuxt UI controls. See `proposal.md` for motivation and `specs/otel-access-tokens/spec.md` for externally visible behavior.

## Goals / Non-Goals

**Goals:**

- Let a trusted operator create, view metadata for, and revoke Collector access tokens from Cairn.
- Authenticate telemetry requests against every currently valid token.
- Keep generated token secrets out of MySQL and out of subsequent API responses.
- Keep Cairn login and user authorization as a future change.

**Non-Goals:**

- Authenticate service SDKs to the Collector; service-to-Collector configuration remains operator-owned.
- Add users, sessions, roles, or authorization to Cairn's management UI or APIs.
- Add token scopes, per-token permissions, or token renewal.

## Decisions

### Store an irreversible digest for each high-entropy token

Generate 32 cryptographically random bytes and encode them as a URL-safe token string. Store a SHA-256 digest, token metadata, and an identifier in a project-scoped MySQL table; return the plaintext only in the generation response. A high-entropy random token does not need password-style slow hashing. Listing returns the token name, expiration, and creation metadata, never the secret. The UI keeps the one-time value only in transient dialog state, provides a copy action, and clears it when dismissed.

Each record contains a unique ID, `projectId`, name, token digest, expiration timestamp, and creation timestamp. Index the digest for verification and the project ID for management queries. Revocation deletes the selected row after confirmation; it does not invalidate any other token.

### Validate bearer tokens from the token table

Before reading or processing an OTLP payload, the ingestion routes parse the `Authorization: Bearer <token>` header, hash the supplied token, and query for a matching digest in the configured project whose expiration is in the future. A missing, malformed, unknown, or expired token returns HTTP 401 before telemetry reaches the ingestion use case. Each route uses the same authentication helper.

All matching unexpired token records remain valid at the same time. This supports updating the Collector to a replacement token before revoking its predecessor. Expired, non-revoked entries remain visible in management with an expired state so operators can distinguish them from revoked tokens; they never authenticate ingestion.

### Require an expiration date and define its boundary

The creation form requires a name and date in the future. The selected date means the token remains valid through the end of that calendar date in the operator's browser timezone; Cairn stores the equivalent UTC timestamp. This gives the date-only form a clear user-facing meaning while the server compares a precise timestamp.

### Keep token management trusted-operator only for this change

The management dialog uses the existing single-project app context and its APIs are not protected by a user login in this change. This is safe only under the agreed assumption that Cairn is reachable by trusted operators. Add no claim that the access token secures Cairn's broader management APIs; it authenticates only the two telemetry ingestion routes.

### Configure the Collector with a secret-backed exporter header

Add an `Authorization` header to the example `otlp_http/app` exporter, sourced from a Collector environment variable rather than committed as a literal. Update the README with the one-time copy step and make clear that the same generated token must be supplied to the Collector. Use HTTPS when traffic crosses an untrusted network; bearer authentication does not encrypt a plain HTTP connection.

### Use a header action and a focused management dialog

Add an access-token action to `AppToolbar` and open a dedicated dialog from `app.vue`. Use Nuxt UI modal, input, button, and alert-dialog controls with inline Tailwind utilities, consistent with the project guidance. The dialog has a creation row for name, required expiration date, and Generate; below it, show token cards with name, expiration/status, and Revoke. A successful generation reveals the secret with a copy affordance and a reminder that it cannot be viewed again. Revoke opens a warning with cancel and confirm actions.

Expose project-scoped list and create APIs under `/api/access-tokens`, and a delete API under `/api/access-tokens/:id`. Validate request and response shapes with shared schemas. Never include digests in responses. Keep repository, use-case, and route responsibilities consistent with the existing layered server architecture.

## Risks / Trade-offs

- **A trusted-network assumption leaves management APIs unauthenticated** → Keep the assumption explicit in the README and this capability; require a separate user-authentication change before exposing Cairn to untrusted users.
- **A plaintext token can be lost after the one-time reveal** → Provide a copy action and explanatory success state; operators can generate a replacement and revoke the lost token.
- **Existing Collector exports fail as soon as ingestion authentication is enabled** → Coordinate rollout: deploy Cairn and migration, generate a token, configure the Collector secret, then resume exports. Expect telemetry gaps during the cutover.
- **Plain HTTP exposes a bearer token to network observers** → Use HTTPS/TLS across untrusted network segments and keep Collector and Cairn on a restricted network for local deployments.
- **Expired rows accumulate** → Continue showing them as expired; cleanup can be added later if volume warrants it.

## Migration Plan

1. Add the access-token table and apply its additive Drizzle migration.
2. Deploy Cairn with token management and protected ingestion routes.
3. Use the dialog to generate an initial token and configure it as a secret in the Collector environment.
4. Resume Collector exports and verify both traces and logs are accepted.

If rollout must be reverted, redeploy the prior app version; the additive token table can remain unused. Do not drop the table as part of rollback because it contains no required legacy data and can be removed in a later migration if desired.

## Open Questions

None for this change. The trusted-operator assumption and required expiry date are explicit scope decisions.
