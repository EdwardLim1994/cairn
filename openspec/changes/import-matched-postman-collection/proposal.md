# Proposal

## Why

Users already maintain API requests in Postman, but recreating those calls as Cairn mock APIs is repetitive. Importing only requests that correspond to registered service endpoints makes setup faster while keeping the graph linked to known services.

## What Changes

- Add a Postman collection JSON import control to the Mock API settings panel.
- Match requests by full service URL and HTTP method, allowing Postman path variables to match registered route parameters; create mock API drafts only for matches.
- Populate imported drafts as REST APIs using the matched endpoint and the Postman request name and JSON body.
- Skip unmatched requests and show a separate warning toast for each skipped request.
- Route Java and .NET APIs through project-local Traefik proxies on their existing localhost ports so Postman URLs and Cairn service URLs use the same host and port.

## Capabilities

### New Capabilities

- `mock-api-import`: Import Postman collection requests as mock API drafts only when they match registered service endpoints.

### Modified Capabilities

None.

## Impact

- Frontend: Mock API settings panel and import parsing in `app/app.vue` and `app/utils/postman-import.ts`.
- Docker Compose: Java and .NET service stacks, plus Cairn's Docker host-gateway egress configuration.
- Existing service endpoint and mock API data structures; no database schema or service API changes are expected.
- Postman collection v2 JSON files selected locally by the user.
