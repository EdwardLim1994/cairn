# Design

## Context

See `proposal.md` for motivation and `specs/mock-api-import/spec.md` for the behavior contract. Mock API drafts live in the frontend until saved. Service endpoints already provide the URL, HTTP method, and API type used by a mock API call. Cairn, Java, and .NET run in separate Docker Compose networks; Postman runs on the host.

## Goals / Non-Goals

**Goals:**

- Parse Postman collection v2 request items from nested folders.
- Link imported requests to registered endpoints and keep imported data in the existing mock API draft flow.
- Keep one canonical `http://localhost:<service-port>` URL usable by both Postman on the host and saved Cairn endpoint registrations.

**Non-Goals:**

- Creating service nodes or endpoint registrations from a collection.
- Importing Postman environments, auth settings, scripts, headers, or non-JSON body modes.
- Changing the persisted mock API schema or server API.
- Joining the Cairn container to either microservice project network.

## Decisions

- Match each request using the effective endpoint URL (`service.baseUrl` joined with `endpoint.url`) and HTTP method. Normalize scheme and hostname casing and trailing slashes; retain path case and query parameters. Match Postman path-variable segments to registered route-parameter segments, but require the service origin and all literal path and query segments to match. Variables in the host or base URL do not match unless they resolve to a concrete value.
- Mark every imported draft as REST, use the matched endpoint for its target, and copy the Postman item name and JSON raw body; when no raw body is provided, use an empty JSON object.
- Skip unmatched requests without adding rows. Show one distinct warning toast per skipped request, identifying its name and whether the URL or method failed to match. Multiple warnings must remain individually visible instead of overwriting the existing single error message.
- Parse and validate the selected collection before appending any drafts. If the file is invalid, report the import error and leave existing drafts unchanged.
- Reuse the existing file picker, draft array, and save flow. Add warning toast state/presentation if needed; no import endpoint or new package is needed.
- Run each microservice stack behind a Traefik container that publishes the services' existing host ports. Give each service its own entrypoint on its existing port so paths and health-check routes remain unchanged; do not publish individual service containers to the host.
- Keep all project networks separate. In Docker, rewrite service-call and health-check targets from `localhost` to `host.docker.internal`, reaching the host-published Traefik ports. Leave host-run Nuxt behavior unchanged. Traefik accepts the `localhost` host used by Postman and `host.docker.internal` used by the Cairn container.
- Update existing saved service base URLs to the matching localhost port after the proxies are running, so their effective endpoint URLs match the Postman collection exactly.

## Risks / Trade-offs

- [Postman variables in the host or base URL cannot be resolved] → The request is skipped with a warning; users can provide a concrete service URL.
- [Collection requests with non-JSON bodies] → They are outside this import scope and are skipped rather than converted into an invalid JSON request.
- [Traefik cannot bind a service port while the old service container still publishes it] → Compose must recreate the services without host port mappings before Traefik takes over those ports.
