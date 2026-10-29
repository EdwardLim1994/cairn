# Tasks

## 1. Postman Request Matching

- [x] 1.1 Parse nested Postman collection items and match full effective service URLs and methods, including Postman path variables against registered route parameters; verify matching and non-matching URL, method, host, and path cases.
- [x] 1.2 Map matched request names and JSON bodies into REST mock API drafts linked to their matched endpoints; verify the imported drafts retain the request name/body and REST type.

## 2. Import Panel Integration

- [x] 2.1 Add the Postman JSON file picker and import button in Mock API settings, appending only matched drafts; verify unmatched collection requests do not add rows.
- [x] 2.2 Show a separate warning toast for each unmatched request, including its name and mismatch reason; verify multiple warnings remain visible at once.
- [x] 2.3 Validate the collection before changing drafts and report invalid-file errors; verify existing drafts remain unchanged after a malformed file is selected.
- [x] 2.4 Run `vp run build` and verify the sample collection against saved service registrations: matched requests become linked drafts and each unmatched request receives a warning.

## 3. Reverse Proxy Integration

- [x] 3.1 Add Traefik to the Java Compose stack on ports 8081–8083, route each port to its service, and remove direct host port publishing from service containers; verify Compose configuration and each proxied endpoint.
- [x] 3.2 Add Traefik to the .NET Compose stack on ports 5001–5005, route each port to its service, and remove direct host port publishing from service containers; verify Compose configuration and each proxied endpoint.
- [x] 3.3 Keep Cairn outside both microservice networks and configure Docker-only localhost-to-host-gateway routing for mock API calls and health checks; verify both call paths reach Traefik while host-run development retains localhost behavior.
- [x] 3.4 Update saved service base URLs and project documentation to the canonical localhost proxy ports; verify Postman URLs and registered full endpoint URLs match.

## 4. Integration Verification

- [x] 4.1 Rebuild the three Compose apps and verify successful and failing Java/.NET API calls, service health checks, and collection import matching through Traefik.
