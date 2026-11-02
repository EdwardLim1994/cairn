# Proposal

## Why

Cairn can send manually configured headers, but it has no first-class authorization setup for mock API calls. Operators need reusable authorization templates that build the correct request credentials for each API, including automatically acquired OAuth client-credentials tokens.

## What Changes

- Add shareable, project-scoped authorization templates in the Mock APIs panel, with a type selector and type-specific fields.
- Support No Auth, Bearer token, Basic Auth, API key in a request header, and OAuth 2.0 Client Credentials; defer Authorization Code and advanced OAuth flows.
- Add an Authorization accordion to each mock API card for selecting a saved authorization template.
- Generate authorization data at request time and prevent execution when it conflicts with a header template or custom header.
- Preserve existing explicit header templates and custom headers for non-authorization headers.

## Capabilities

### New Capabilities

- `mock-api-authorization`: Configure reusable authorization templates and apply them to mock API requests.

### Modified Capabilities

None.

## Impact

- Mock API settings UI, shared request/response schemas, and project settings persistence APIs.
- Drizzle schema and migration for authorization templates and mock API associations.
- Mock API readiness evaluation and server-side outbound request execution.
- Unit, component, and MySQL-backed integration coverage.
- Postman collection authorization import remains unsupported and continues to report warnings; import mapping is outside this change.
