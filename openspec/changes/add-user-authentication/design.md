# Design

## Context

See `proposal.md` for the motivation. Cairn currently renders its management UI from one `app/app.vue` component and has no login or server-wide app authorization middleware. Runtime settings are read through `getAppConfig()` and validated during Nitro startup. OTLP ingestion routes already validate bearer access tokens independently.

## Goals / Non-Goals

**Goals:**

- Establish one shared operator identity per Cairn deployment without adding user records to MySQL.
- Enforce authentication on server-side management APIs as well as the browser UI.
- Keep OTLP collector credentials independent from browser login sessions.

**Non-Goals:**

- Individual accounts, roles, audit attribution, password recovery, or external identity providers.
- Adding database tables or changing project data ownership.

## Decisions

1. **Use deployment environment variables for the shared identity.** Add `AUTH_ENABLED` (default `true`), `AUTH_USERNAME`, `AUTH_PASSWORD`, and `AUTH_SESSION_SECRET`. When enabled, startup validation requires non-empty credentials and a session secret of at least 32 characters. The runtime config must expose these values only to server code. Docker Compose forwards the auth settings, and `.env.example` documents safe placeholders. This fits Cairn's current single-operator model and avoids a user database. A database-backed account or external identity provider would add setup and lifecycle work.

2. **Use a protected login route and preserve the current UI as the main route.** Move the current root UI into `app/pages/index.vue`, make `app/app.vue` render the Nuxt page outlet, and add `app/pages/login.vue`. A Nuxt route middleware redirects unauthenticated browser navigation to `/login` and carries a validated local return path. After successful sign-in, return to that path or `/`. Keep auth enabled/disabled state in a small public session-status response so the UI can skip login when explicitly disabled.

3. **Enforce access on the server, not only in the route middleware.** Add centralized Nitro middleware for `/api/**` that exempts only the login, logout, and session-status endpoints. Other management APIs require a valid Cairn session and return 401 when missing. The browser route middleware improves navigation but is not an authorization boundary by itself.

4. **Use an encrypted, HTTP-only session cookie with a bounded lifetime.** Use the existing H3/Nitro session support with `AUTH_SESSION_SECRET`; set `httpOnly`, `sameSite: "lax"`, path `/`, and an eight-hour maximum age, with `secure` enabled in production. Rotate session contents on successful login and clear the cookie on logout. This avoids a session table and its migration, while keeping the session unreadable and verifiable by the server. SameSite cookies and same-origin checks on state-changing browser requests mitigate cross-site request forgery.

5. **Keep OTLP ingestion on its existing bearer-token boundary.** The app-auth middleware covers management APIs but does not replace or bypass `requireOtelAccessToken` on `/v1/traces` and `/v1/logs`. This lets collectors keep their dedicated credentials regardless of browser-auth configuration.

6. **Make bypass explicit and fail closed.** Only the exact configured false value disables application authentication; missing or unrecognized values leave authentication enabled. When enabled but required settings are invalid, startup fails with a configuration error that does not include secret values. Authentication-disabled mode bypasses browser and management API sessions, while OTLP bearer-token checks remain active.

## Risks / Trade-offs

- [A shared password cannot identify individual operators or support per-user revocation] → Document that all internal users share one identity; rotating the environment password changes access for everyone.
- [Cookie-based sessions remain valid until expiry if copied] → Use HTTP-only, secure-in-production, SameSite cookies with an eight-hour expiry; changing the session secret invalidates existing sessions.
- [Authentication defaults to enabled and can prevent startup until operators configure credentials] → Add the variables and generation guidance to `.env.example`, Compose configuration, and deployment documentation.
- [A deployment can be exposed if auth is explicitly disabled] → Keep the default enabled and document the bypass as suitable only for trusted networks.

## Migration Plan

No database migration is needed. Add the auth environment variables to local and Compose configuration, set a unique session secret for deployments, then deploy the app with authentication enabled. Rollback can revert the application change; no persisted app data changes. Setting `AUTH_ENABLED=false` provides an explicit temporary bypass for trusted deployments.
