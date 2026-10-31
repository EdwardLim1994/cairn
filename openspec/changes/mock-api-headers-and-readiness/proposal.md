# Proposal

## Why

Cairn cannot currently reproduce requests that require custom headers, and importing Postman APIs without their variables can leave requests unusable without explaining why. Named header templates, separate environment import, and explicit activation will make reusable requests configurable while preventing incomplete APIs from running and protecting unsaved panel edits.

## What Changes

- Add project-scoped named header templates and per-API custom header tables in the Mock APIs panel. Each API can opt into one template; custom values override template values case-insensitively.
- Resolve header value variables at execution, validate header inputs, and preserve Cairn-owned trace propagation.
- Confirm template deletion with affected API names, then detach and delete together without removing custom headers.
- Extend collection import to retain enabled request headers, warn about unsupported authorization/scripts and missing variables, and retain unmatched requests as inactive drafts for later matching or manual endpoint selection.
- Add a separate Postman environment import action that creates variable drafts and skips duplicate names with warnings. Neither import silently overwrites variables or creates header templates.
- Add saved API activation and derived Draft/Inactive/Ready status. Imported APIs start inactive; incomplete APIs automatically become inactive and never automatically reactivate.
- Keep edits, imports, and activation changes within existing Save/Discard semantics, including staged dependency deletions.
- Stop outside clicks from closing every application panel; preserve explicit close and existing keyboard behavior.
- Defer per-header enable/disable checkboxes, multiple templates per API, multiple environment profiles, and Postman script execution.

## Capabilities

### New Capabilities

- `mock-api-headers`: Named header templates, per-API overrides, variable resolution, and template deletion.
- `mock-api-readiness`: Saved activation, draft persistence, readiness reasons, and execution guards.
- `postman-import`: Separate API/environment imports, unresolved references, matching, warnings, and draft lifecycle.
- `panel-edit-preservation`: Prevent outside-click dismissal of application panels.

### Modified Capabilities

None in the durable spec inventory: `openspec/specs` currently contains no capabilities. Existing change deltas are contextual baselines, not durable main specs. This change intentionally supersedes prior change-only rules that skip unmatched collection requests or require endpoint selection for every saved mock API.

## Impact

- Database: add header templates, template association, custom header rows, activation, and unresolved import metadata through additive Drizzle migrations.
- API: extend mock API and canvas response contracts, add project-scoped template CRUD, accept incomplete inactive drafts, and guard execution on the server.
- Frontend: Mock APIs panel, graph trigger controls, shared API client, models/stores/view models, and all panel backdrops.
- Importers: Postman collection parser and a separate environment parser; existing endpoint matching remains the basis for successful matches.
- Existing data: preserve request bodies, paths, graph connections, and run history. Existing valid APIs retain trigger availability; incomplete legacy entries become inactive.
- Dependencies: use installed Nuxt UI, Drizzle, and existing variable resolution patterns; no new runtime dependency is planned.
