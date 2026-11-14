<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Running Scripts

Run TypeScript and JavaScript files with `vpx <file>`, for example `vpx ./scripts/seed.ts --dry-run`. It handles enums, decorators, JSX, and tsconfig `paths`, so do not add `tsx` or `ts-node` to run scripts. `vpx --watch <file>` reruns the file when a file it uses changes, in place of `tsx watch`. `vp node <file>` runs plain Node.js.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Cairn project context

Cairn is a Nuxt 4 single-page app backed by Nitro server routes, Drizzle ORM, SQLite application data, and DuckDB telemetry. Users register Spring Boot, .NET, or custom services, connect service endpoints and message destinations in a Vue Flow graph, and run REST, GraphQL, unary gRPC, or raw WebSocket mock APIs. Cairn correlates OpenTelemetry traces and logs to a run; graph highlighting and call timing must come from observed telemetry, not configured edges alone. The graph, mock APIs, shared variables, templates, access tokens, and telemetry are scoped to `PROJECT_ID`.

The frontend follows Feature-Sliced Design: `app/shared` supplies reusable UI and API code, `app/entities` owns canonical service, destination, and mock API data, `app/features` owns editing and execution actions, `app/widgets` composes graph and panel views, and `app/pages/index.vue` coordinates bootstrap and cross-widget events. Import lower layers through slice `index.ts` public APIs; keep peer slices decoupled. Place migrated tests in their owning slice's `_test_` directory. The toolbar, graph canvas, and node types load initially; closed panel UI and panel-only fetches load on first open. See `app/ARCHITECTURE.md`.

Prefer Tailwind CSS v4 utilities in component templates for visual properties such as layout, spacing, typography, sizing, borders, and states, keeping those choices next to the elements they affect. Keep shared theme tokens, global resets, and custom or third-party integration styles in `app/app.vue` where utility classes are not a good fit. Use app-specific BEM classes (`app__element`, `app__element--modifier`) only when needed for semantic or state hooks, custom selectors, pseudo-elements, or integrations; leave third-party Vue Flow/CodeMirror classes intact. Tailwind CSS v4 is not configured for Sass preprocessing.

### UI components

- Prefer Nuxt UI components for generic buttons, inputs, selects, dropdowns, accordions, alerts, dialogs, and slideovers. Use their `class` and `ui` props for Tailwind utilities and theme tokens; add BEM classes only when a semantic hook or custom selector is needed rather than rebuilding generic interactions. Preserve Cairn-specific state, dismissal, and save/discard behavior when adopting them.
- Keep thin Cairn wrappers when they connect a Nuxt UI component to app-specific state or events. Do not wrap Nuxt UI only to rename its API.
- Keep Vue Flow canvas/nodes and the CodeMirror request editor as Cairn-specific components; their behavior is domain-specific and should not be replaced with generic UI controls.
- Nuxt UI is registered through `@nuxt/ui` in `nuxt.config.ts`, with its Tailwind styles imported in `app/app.vue`. Component tests that mount panels outside Nuxt should stub the Nuxt UI controls and verify the panel's emitted intents and model updates.
- Graph connections use square step paths by default. Keep observed timing labels, endpoint-dot highlighting, and response-panel focus in sync with the telemetry and graph view models.
- Workspace drawers use the shared `app/shared/ui/WorkspaceDrawer.vue` slideover. They open on the right, and the shared component sets their top and bottom viewport gaps below the toolbar; adjust these bounds there rather than in individual panels. Header and authorization templates have separate accordions in the Mock APIs panel.

### Mock APIs and shared variables

- Mock API entries target registered service endpoints. Endpoint route templates may contain `{name}`, `{name:constraint}`, or `:name` parameters; mock API path values are URL-encoded before outbound calls.
- Supported mock API types are REST, GraphQL, unary gRPC, and raw WebSocket. GraphQL subscriptions and SSE APIs are future work; do not imply that WebSocket support covers them.
- WebSocket mock APIs send saved text messages. Connect opens the session, Trigger sends a message only while connected, and Disconnect closes it. Only one mock API session may use a registered endpoint at a time, but different endpoints can stay connected concurrently. Incoming text messages are retained in a bounded client-side buffer while the response panel is closed; runtime sessions are in memory and are not coordinated across Cairn replicas.
- Service health checks use GET. Spring Boot and .NET have framework defaults; `Other` and WebSocket services need an explicit URL. Custom health-check headers can be combined with a shared header template.
- Environment variables are project-scoped strings. References use `{{name}}` in JSON string values or path parameter values. Do not treat environment values as typed JSON.
- Shared header templates and authorization templates can be applied to mock APIs and custom health checks. Authorization supports Bearer, Basic, API key, and OAuth 2.0 Client Credentials; provider-specific OAuth flows are not supported. Header-name conflicts between authorization and raw custom headers make an API not ready.
- The Mock APIs panel uses single-item editors for mock APIs, shared variables, header templates, and authorization templates. Create and Update save one item, then refresh canonical canvas data before showing success. Close, Back, and Discard protect changed drafts; Delete requires confirmation. Do not reintroduce panel-level batch Save. Existing variable updates skip the PUT when the name and value are unchanged.
- REST and gRPC request payloads use CodeMirror 6 with JSON language support; GraphQL requests use a GraphQL-aware editor. Chained mock calls are future work.

### Telemetry and response panels

- A completed mock API run opens its trigger node's response panel, closes any previously open response panel, and centers and zooms the graph viewport on the newly opened panel. Do not restore the removed global latest-run response panel.
- REST, GraphQL, and gRPC response panels show status, trace ID when available, and total trace duration derived from earliest span start to latest span end. WebSocket panels show incoming text messages. Duration is unavailable when the trace has no spans.
- Observed edge timing sums durations from matching outbound OTLP `CLIENT` spans by source/target service pair. Repeated calls and retries contribute each span duration; this sum can exceed wall-clock elapsed time when calls overlap. Missing client-span telemetry is shown as unavailable, not zero. Keep per-call duration details available on the edge label.
- Animate observed downstream connections and accent their source outbound and target inbound dots; dim unrelated service endpoint dots. Clear these observations when a new run begins and restore them from the selected saved-run history entry when replaying.
- OTLP ingestion uses Cairn access tokens (`Authorization: Bearer ...`), separate from shared operator login. Multiple unexpired, unrevoked access tokens are valid concurrently. Secrets are shown once at creation; expiry and revocation invalidate the token.

### Runtime and validation

- Use `vp run db:generate` and `vp run db:migrate` for Drizzle SQLite schema changes. Add migration SQL and metadata together; preserve existing data when changing column types.
- Use `vp run dev`, `vp run build`, `vp check <changed paths>`, and `vp test run <test paths>` for development and focused validation.
- Docker uses Bun for dependency installation and the Nuxt build, then Node to serve the generated Nitro output. Compose defaults to port `3004`; keep `Dockerfile`, `docker-compose.yml`, and `.env.example` aligned when changing runtime settings.
- Docker Compose runs Cairn with a persistent `app_data` volume for SQLite and DuckDB. `OUTBOUND_HOST_GATEWAY` rewrites container-side `localhost` targets to the host gateway so Cairn can call separately networked service projects through their published reverse proxies.
- Keep the relevant OpenSpec change artifacts in sync when implementation behavior changes. Validate the active change with `openspec validate <change-name> --strict`.
