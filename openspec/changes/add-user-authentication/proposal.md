# Proposal

## Why

Cairn's management interface and application APIs are currently usable by anyone who can reach the deployment. A shared operator login gives internal users a simple sign-in flow and prevents unauthenticated access without introducing user accounts or a database-backed identity system.

## What Changes

- Add a login page for one shared operator username and password configured through environment variables.
- Protect Cairn's application pages and management APIs with a session after successful login, and provide a sign-out action.
- Enable authentication by default, with an explicit environment setting to disable it for trusted deployments.
- Keep OTLP traces and logs ingestion authenticated by its existing bearer access tokens.
- Document the required authentication environment variables and Docker Compose configuration.

## Capabilities

### New Capabilities

- `user-auth`: Sign in to Cairn with a shared operator credential and protect the application behind an authenticated session.

### Modified Capabilities

None.

## Impact

- Nuxt page routing and server middleware/API authorization.
- Login and logout endpoints, session handling, and header UI.
- Runtime configuration, `.env.example`, Docker Compose, and setup documentation.
- Existing OTLP ingestion remains separately protected by the current access-token capability.
