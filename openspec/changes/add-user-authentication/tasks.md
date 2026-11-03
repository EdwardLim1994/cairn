# Tasks

## 1. Authentication Configuration

- [ ] 1.1 Extend server configuration to parse `AUTH_ENABLED` as enabled by default, validate shared credentials and a 32-character session secret when enabled, and verify config tests cover omitted, disabled, and invalid settings.
- [ ] 1.2 Forward authentication environment variables through Docker Compose and document local/deployment setup plus session-secret generation in `.env.example` and the project README; verify a new deployment can follow the instructions without exposing real secrets.

## 2. Server Session and Authorization

- [ ] 2.1 Add shared credential verification, encrypted session-cookie management, and public login/logout/session-status endpoints; verify unit and API tests cover valid/invalid credentials, expiry, logout, and absence of secrets in responses.
- [ ] 2.2 Add centralized server authorization for all management APIs, exempting only auth endpoints and leaving OTLP routes on bearer-token validation; verify unauthenticated requests return 401, authenticated requests proceed, and OTLP token tests pass with application auth both enabled and disabled.
- [ ] 2.3 Add same-origin validation for state-changing cookie-authenticated requests and verify cross-origin requests are rejected without blocking same-origin UI requests.

## 3. Login and Main UI Routes

- [ ] 3.1 Add the login form and post-login return handling, then verify component tests cover successful login, generic invalid-credential feedback, and safe local return destinations.
- [ ] 3.2 Move the current single-page Cairn UI behind the main Nuxt route, add route middleware and a sign-out control, and verify protected navigation redirects to login while a valid session opens the requested route.
- [ ] 3.3 Handle auth-disabled and expired-session states in the UI and verify the main interface opens without login only when auth is explicitly disabled.

## 4. Integration Verification

- [ ] 4.1 Add integration coverage for the full browser-login-to-protected-API flow, session expiry/logout, auth-disabled access, and independently protected OTLP ingestion; verify the focused integration suite passes.
- [ ] 4.2 Run the project check and build commands and verify the Nuxt route structure, server middleware, and client API handling compile together.
