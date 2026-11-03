# Spec Delta

## Purpose

This capability gives internal operators a shared sign-in flow and restricts Cairn's management pages and APIs to authenticated sessions when authentication is enabled.

## ADDED Requirements

### Requirement: Configure shared operator credentials

Cairn SHALL use one operator username and password configured through environment variables when authentication is enabled, and SHALL NOT expose these credentials to the client.

#### Scenario: Start with authentication configured

- **WHEN** authentication is enabled and the username, password, and session secret are configured
- **THEN** Cairn starts with the shared operator login available

#### Scenario: Start without required authentication configuration

- **WHEN** authentication is enabled and any required credential or session secret is missing or invalid
- **THEN** Cairn fails startup with an error identifying the invalid configuration without exposing credential values

### Requirement: Authenticate operators through the login page

Cairn SHALL provide a login page that accepts the configured operator username and password and establishes a session only when both match.

#### Scenario: Successful login

- **WHEN** a user submits the configured username and password
- **THEN** Cairn establishes an authenticated session and opens the requested application page or the main page

#### Scenario: Invalid login

- **WHEN** a user submits an incorrect username or password
- **THEN** Cairn rejects the login, displays a generic authentication error, and does not establish a session

### Requirement: Protect application pages and APIs

When authentication is enabled, Cairn SHALL require an authenticated session for all application pages and management APIs, except the login flow and separately authenticated OTLP ingestion routes.

#### Scenario: Unauthenticated page request

- **WHEN** a user requests an application page without a valid session
- **THEN** Cairn redirects the user to the login page and preserves the requested destination for after login

#### Scenario: Unauthenticated management API request

- **WHEN** a client requests a management API without a valid session
- **THEN** Cairn returns HTTP 401 and does not perform the requested operation

#### Scenario: Authenticated application request

- **WHEN** a user requests an application page or management API with a valid session
- **THEN** Cairn processes the request according to its existing behavior

### Requirement: End an operator session

Cairn SHALL provide a sign-out action that invalidates the browser's authenticated session.

#### Scenario: Sign out

- **WHEN** an authenticated user signs out
- **THEN** Cairn clears the session and subsequent protected requests require login

### Requirement: Allow explicit authentication disablement

Cairn SHALL enable authentication by default and SHALL allow an operator to explicitly disable it through an environment variable for trusted deployments.

#### Scenario: Authentication uses its default setting

- **WHEN** the authentication setting is omitted
- **THEN** Cairn requires authentication

#### Scenario: Operator disables authentication

- **WHEN** the operator explicitly configures authentication as disabled
- **THEN** Cairn permits access to application pages and management APIs without login

### Requirement: Keep OTLP ingestion independently authenticated

Cairn SHALL continue to require valid bearer access tokens for OTLP traces and logs ingestion regardless of the application authentication setting.

#### Scenario: OTLP request while application authentication is disabled

- **WHEN** a client submits traces or logs without a valid OTLP bearer token while application authentication is disabled
- **THEN** Cairn returns HTTP 401 and does not persist the telemetry
