# Design

## Context

Cairn stores project-scoped raw header templates and per-API custom headers. Each mock API can select one header template; custom headers override duplicate template headers case-insensitively. The run use case resolves `{{variable}}` references, creates a `Headers` object, and sends the request from the Cairn server. Mock API settings save staged variables, templates, and APIs together. See `proposal.md` for motivation and the capability spec for behavior.

## Goals / Non-Goals

**Goals:**

- Configure reusable authorization methods once and assign them to specific mock APIs.
- Keep authorization fields type-specific and show generated credentials as system-managed request data.
- Acquire OAuth client-credentials access tokens on the server and reuse them until shortly before expiry.
- Reject ambiguous authorization when raw headers collide with an authorization template.

**Non-Goals:**

- Import Postman authorization settings automatically; collection import continues to report auth as unsupported.
- OAuth Authorization Code, PKCE, refresh-token grants, OAuth 1.0, or provider-specific custom token parameters.
- API keys in query parameters or cookies.
- A credential vault or protection from trusted operators who can access Cairn's settings and APIs.

## Decisions

### Store authorization templates separately from raw header templates

Add a project-scoped `authorization_templates` table with ID, name, auth type, type-specific JSON configuration, and timestamps. Add a nullable `authorization_template_id` reference on mock APIs. Use a discriminated union in shared request schemas so each auth type accepts only its own fields. A separate model is needed because OAuth acquires credentials at run time, while raw header templates are static name/value rows.

Include authorization templates in the existing staged Mock API settings save transaction. Map client draft IDs to persisted IDs in the same way as header templates. Deleting a template detaches referencing APIs in the saved settings operation; readiness is then reevaluated. Keep project ownership checks on template lookup and API assignment.

### Match the existing template workflow and Postman's conditional editor pattern

Add a **Shareable authorization templates** section alongside the existing shareable header templates. **New template** creates an expanded accordion card in edit mode. The card contains a name and auth-type dropdown; changing the type renders only that type's fields. The API card gains a collapsible **Authorization** section with a selector for **No Auth** or a named authorization template and a summary of the selected method. The type-specific fields live on the reusable template card, not duplicated on every API.

Use the existing panel Save/Discard behavior for edits and API assignments. Type-specific secret inputs may be visually masked, with an explicit reveal control when editing. Authorization-generated headers are presented as read-only/system-managed so users can see their source without editing a second copy.

### Support four credential configurations

- **Bearer token:** token value; emit `Authorization: Bearer <value>`.
- **Basic Auth:** username and password; emit the standard HTTP Basic `Authorization` value.
- **API key:** key name and value; emit only as a request header in this change.
- **OAuth 2.0 Client Credentials:** token URL, client ID, client secret, and optional scope. Cairn makes a server-side POST using `grant_type=client_credentials`, form-encoded parameters, and `client_secret_basic` client authentication. Authorization Code and provider-specific token request fields are deferred.

Resolve existing `{{variable}}` references in static credential fields using the project's string environment-variable resolver. OAuth token URLs must be valid HTTP(S) URLs and use the existing outbound timeout. Treat token endpoint failures as run failures before creating/sending the target request; never include client secrets, returned access tokens, or auth headers in logs or readiness diagnostics.

Cache OAuth tokens in process memory by project and template ID/configuration. Reuse a token until shortly before the returned `expires_in` time; if the response omits a usable expiry, do not cache it. Concurrent runs should share an in-flight token request for the same template. Cache entries naturally disappear on process restart and are invalidated when the template configuration changes.

### Validate conflicts before executing a mock API

Extend the shared readiness evaluator and the server-side run preflight with the selected authorization type and generated header names. Compare names case-insensitively against both the selected raw header template and per-API custom headers. If any raw row defines a header owned by the auth template, mark the API as a draft with a conflict reason and send no request. This includes `Authorization` for Bearer, Basic, and OAuth, and the configured key name for API key auth. Keep the existing precedence between raw header templates and custom headers unchanged for non-auth headers. Cairn continues to own and set `traceparent`.

### Preserve the current credential storage boundary

Persist auth configuration in MySQL with the existing project settings and return it to the trusted Cairn UI for editing, following the current raw-header template model. Masking inputs improves casual visibility but does not encrypt values in the database or hide them from someone with access to Cairn's APIs. A dedicated secrets vault and user login remain separate future work.

## Risks / Trade-offs

- **Auth fields add secret material to project settings** → Keep diagnostics and logs redacted, visually mask secrets, and document the trusted-operator assumption; add encrypted secret storage before supporting less-trusted multi-user access.
- **OAuth providers vary in token parameters and client authentication** → Start with standard Client Credentials using `client_secret_basic`, form-encoded token requests, and optional scope; defer provider-specific extensions.
- **OAuth tokens can expire during concurrent or slow requests** → Refresh with a safety margin and coalesce concurrent acquisition; return an actionable, redacted run error if acquisition fails.
- **Authorization and raw headers can conflict** → Detect conflicts before execution and identify the header name without exposing either value.
- **Saved templates affect multiple APIs** → Recompute readiness when template content changes and display affected configuration errors in the referencing API cards.
- **Postman collections may contain auth settings** → Keep current explicit unsupported-auth warnings until a separate importer change defines safe mappings.

## Migration Plan

1. Add the authorization template table and nullable mock API association using an additive Drizzle migration; existing APIs default to no authorization.
2. Deploy the API schemas, staged settings persistence, runtime resolver, and UI together so no partial authorization model is exposed.
3. Existing raw header templates and custom headers remain unchanged. If they contain authorization headers, leave those APIs executable while no authorization template is selected; show a conflict and require cleanup when an authorization template is assigned.
4. Roll back by redeploying the prior application version while retaining the additive table and column. The prior version ignores them; do not remove user-created configuration as part of rollback.

## Open Questions

None. The supported auth types, OAuth grant, template assignment model, and conflict behavior are set for this change.
