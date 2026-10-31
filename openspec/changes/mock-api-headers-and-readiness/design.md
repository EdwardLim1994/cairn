# Design

## Context

See proposal.md for motivation and the four capability deltas for acceptance behavior.

The current Postman parser creates endpoint-linked drafts and skips unmatched requests. It reads collection variables only for URL matching, ignores header/auth/event fields, and returns no environment cards. `useMockApiViewModel` saves variables and mock APIs through sequential calls; saved variable Update is immediate, while new cards and deletions are staged. `mockApiInput` and shared schemas currently require an endpoint even though the database foreign key is nullable. The run use case generates `traceparent` and a JSON content type but accepts no user headers or activation flag. Service and Mock APIs settings explicitly discard through backdrop `click.self` handlers. Logs and Latest run already expose deliberate controls.

No durable main specs exist yet. Prior change deltas describe skipping unmatched requests and requiring endpoints; this proposal deliberately replaces those behaviors for inactive drafts. It does not edit those prior changes.

## Goals / Non-Goals

**Goals:** Share one readiness definition between client feedback and authoritative server checks, preserve variable placeholders, keep saved and staged state distinct, and ship additive persistence changes using current layers and installed dependencies.

**Non-Goals:** Full Postman execution compatibility, auth helper translation, executing imported scripts, secret vault integration, multiple environment profiles, template inheritance, multiple templates per API, and enabling/disabling individual header rows. Per-header checkboxes are an explicit future TODO, not part of this implementation.

## Decisions

### 1. Persist templates separately and keep header rows ordered

Add a project-scoped `header_templates` table with UUID, unique project/name, ordered JSON rows `{ name, value }`, and timestamps. Add nullable template association, ordered custom header rows defaulting to `[]`, activation, and optional import-source metadata to mock APIs. Import metadata stores request method, original URL, and a URL with collection-only substitutions applied, so unresolved environment references survive reload without storing the entire collection. Template names use existing card naming conventions: trimmed, nonempty, bounded text. Header names are literal, not variable templates.

Use row arrays rather than a JSON object because users edit rows and need stable display order and duplicate diagnostics. Require unique header names within each table after ASCII case normalization. The template association is a live reference rather than a copy; server queries enforce project ownership even when a foreign key validates existence.

New API cards default inactive, as do all imported cards. Backfill preexisting rows as active candidates and reconcile readiness before exposing them as executable, preserving valid legacy behavior and deactivating incomplete rows. Do not persist a separate status enum: derive Draft/Inactive/Ready and structured reasons from configuration and active flag.

### 2. Merge effective headers once and protect generated tracing

Build effective headers from optional template plus custom rows, matching names case-insensitively. Custom values win; a blank value is a real empty value, not omission. Resolve variables only in effective values after overrides, so an overridden template value does not create a false missing-variable dependency. Reuse existing variable syntax and string semantics through a focused shared string resolver/reference scanner rather than duplicating a second placeholder language.

Validate names and raw values on save; validate resolved values again before fetch. Reject CR/LF, invalid header names, duplicate names within a table, and user `traceparent`. Apply the existing JSON content type default only when the effective request lacks an explicit content type; retain existing request-body serialization. Report invalid header/variable names without echoing authorization values. Native Headers validation supplements explicit checks at the trust boundary. Invalid imported rows are skipped with named warnings rather than silently accepted; valid rows remain editable.

Alternative: last-row-wins duplicates within one table were rejected because hidden duplicates would make row editing misleading. Supporting repeated-value headers is outside this first slice.

### 3. Treat incomplete drafts as persisted configuration, not malformed input

Allow nullable endpoint selection for inactive drafts and preserve unresolved source metadata. Still require a name and structurally valid JSON, header rows, IDs, and bounded strings. Missing variable values or endpoint selection are readiness failures, not save failures. Unsupported non-JSON Postman bodies retain existing skip-with-warning behavior; this proposal does not introduce arbitrary body formats.

The readiness evaluator checks endpoint existence and ownership, route parameter completeness, effective header validity, and variable references in path values and JSON string values. Imported source URLs are checked while unresolved matching remains pending; after explicit endpoint selection the registered method/route is authoritative, so unused import metadata cannot permanently block an API. Warn when manual selection replaces an unmatched request method/URL. References masked by a custom header override are not required. Empty environment strings count as defined, subject to the destination's validation.

Expose structured reason codes and names to clients and prevent enabling an invalid draft. Existing imports that have a usable endpoint still warn about unresolved path/header/body variables. Graph rendering omits edges for null endpoints and disables triggers for saved inactive or invalid entries. Unsaved activation never enables execution against unsaved configuration.

### 4. Deactivate at dependency mutation boundaries and recheck before execution

A shared evaluator serves draft feedback, saved reads, mutations, and run validation. Staged variable deletion, rename, template edits/deletion, endpoint changes, and request edits update affected draft activation to false when invalid. Restore snapshots on Discard. Creating the missing dependency later clears reasons but never flips active back on automatically.

On the server, variable update/delete, template update/delete, and endpoint update/delete revalidate affected project APIs and persist deactivation in the same transaction as the dependency mutation. Include the existing immediate variable Update action in this rule; a deliberate Update remains an immediate save under the established variable workflow. Saved mock API mutations normalize invalid requested activation to false and return reasons. Reload/list reconciliation covers legacy invalid rows. Run performs a fresh readiness check and persists any detected deactivation before rejecting an invalid or inactive request; it does not send fetch or create a running run record for rejected preflight.

This is configuration readiness, not remote health: endpoint outages or a target returning an HTTP error do not automatically deactivate otherwise valid requests. Use existing failure/run reporting for those conditions.

### 5. Keep staged settings writes coherent

Template deletion confirmation lists affected saved and staged API names. Confirm stages template removal and association detachment; Cancel changes nothing. Save performs detachment, deletion, custom-header preservation, and readiness/deactivation as a transaction. Do not deactivate merely because a template is detached if the resulting API remains valid: sending fewer headers may cause a remote HTTP error but cannot be inferred as local incompleteness.

Introduce a focused project settings-save use case/API for the staged variable, template, and mock API mutations. Use client draft IDs mapped to generated server IDs so a newly created template can be selected before its first Save. Validate all inputs before writing, resolve associations inside the transaction, and evaluate the final configuration rather than temporary intermediate states. This replaces sequential panel persistence for these staged entities, preventing saved dependency changes without their related deactivations. Canvas positions continue through the existing canvas path and are not included in this transaction. Keep existing individual CRUD routes for their current callers, with the same ownership and deactivation invariants.

Alternative: merely ordering current sequential calls cannot satisfy atomic template detach/delete or preserve activation consistently on partial failure. No generic unit-of-work framework is needed; implement the transaction at this settings boundary using existing repository/use-case layering. Reject stale references rather than silently recreating deleted saved entities.

### 6. Separate import parsers and preserve import order independence

Keep API and environment file controls separate in Mock APIs settings. A small environment parser accepts the Postman environment `values` entries and metadata, stages enabled valid entries, preserves empty strings, stringifies number/boolean scalars, and warns/skips null or structured values and invalid Cairn names. Match duplicate names using Cairn variable identity rules against both saved and staged cards and earlier accepted rows; skip all collisions with warnings, even equal values. Disabled entries are omitted. Never expose imported values in warning messages.

Extend the collection parser to accept current Cairn variable drafts for URL matching. Cairn values take precedence over collection fallback values; collection variables never become cards implicitly. Keep raw placeholders in request body, custom header values, and original URL metadata. Preserve collection-only URL substitutions separately so retrying matching after reload does not require keeping the original file. For unmatched or unresolved URLs, create inactive drafts with reasons rather than dropping otherwise supported requests. Re-run matching only for unresolved automatic matches when variables or available endpoints change; never silently replace a user's manual selection.

Import enabled explicit header rows; warn for unsupported auth/event behavior at request or inherited folder/collection scope without attempting script execution or automatic template deduplication. Recompute missing-variable diagnostics after imports, edits, and deletions. All accepted imports remain staged until Save and disappear on Discard.

### 7. Extend current panels rather than replacing them

Add Header templates as a sibling section to shared variables and registered mock APIs. Reuse settings accordion cards and Nuxt UI controls; a thin header-row editor is justified only because both template and API tables share row editing behavior. Keep Cairn BEM selectors and existing theme tokens. Stub generic Nuxt UI controls in standalone panel tests.

Place template selection and custom rows below each API's URL display. Add Active switch and status/reasons on the card; reflect persisted state in mock graph node trigger controls. Add environment import beside the existing variable actions and keep API import with registered APIs.

Remove outside-click dismissal from Service and Mock APIs dialogs and audit Logs, Latest run, and parent event handlers for equivalent dismissal. Preserve explicit close/Save/Discard and existing Escape behavior. Menus, selects, and deletion confirmation dialogs remain normal transient UI; no global document-click suppression is needed.

## Risks / Trade-offs

- Shared template edits affect multiple APIs. Mitigation: revalidate referencing APIs, retain per-API overrides, and identify affected APIs in deletion confirmation.
- Imported collections can contain unsupported auth/scripts or variable scopes. Mitigation: warning messages explain the omitted behavior; inactive imports require explicit user activation.
- Stale client drafts can refer to deleted templates or variables. Mitigation: server ownership/existence checks and final-state validation precede writes, with fresh checks before execution.
- Storing authorization text in the existing database is not secret management. Mitigation: do not copy values into logs or diagnostics; placeholders reuse existing variables without adding a new vault promise.
- MySQL DDL is not fully transactional. Mitigation: generate and review additive migrations, back up data, and test migration on an existing database before deployment.
- Discard cannot undo the existing explicit immediate variable Update action. Mitigation: retain its established saved-state behavior and restore only unsaved panel changes; dependency deactivation caused by Update is saved as well.

## Migration Plan

1. Generate and commit Drizzle SQL plus metadata for templates and new mock API columns. Preserve existing JSON bodies, path parameters, endpoint IDs, and run history.
2. Test fresh migrations and upgrade of existing rows. Preserve activation for valid preexisting APIs through reconciliation; imported and newly created APIs default off.
3. Deploy the rebuilt image using the existing pending-migration startup runner. Reconcile saved readiness before exposing graph triggers.
4. Verify Save/Discard, separate import orders, template deletion transaction, direct run rejection, and panel outside-click behavior against MySQL-backed tests and component tests.
5. Roll back application image if necessary while retaining additive tables and columns and the database volume. The older image ignores new fields but does not enforce activation; pause triggering during rollback and treat rollback as reverting these execution controls. Do not drop new data as part of rollback.

## Deferred TODO

- Add an enable/disable checkbox on every header row, including template headers as used by one API. Define omission and override precedence in that future change; no disable state is stored now.
