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

Cairn is a Nuxt 4 single-page app for registering microservices and endpoints, connecting them in a Vue Flow graph, triggering mock REST calls, and inspecting correlated OpenTelemetry traces and logs. The server uses Drizzle ORM with MySQL. The app uses Tailwind utilities and native CSS nesting in `app/app.vue`. Keep app-specific selectors in BEM form (`app__element`, `app__element--modifier`); leave Tailwind utility and third-party Vue Flow/CodeMirror classes intact. Tailwind CSS v4 is not configured for Sass preprocessing.

### UI components

- Prefer Nuxt UI components for generic buttons, inputs, selects, dropdowns, accordions, and alerts. Use their `class` and `ui` props to apply Cairn's existing BEM selectors and theme tokens rather than rebuilding generic interactions.
- Keep thin Cairn wrappers when they connect a Nuxt UI component to app-specific state or events. Do not wrap Nuxt UI only to rename its API.
- Keep Vue Flow canvas/nodes and the CodeMirror request editor as Cairn-specific components; their behavior is domain-specific and should not be replaced with generic UI controls.
- Nuxt UI is registered through `@nuxt/ui` in `nuxt.config.ts`, with its Tailwind styles imported in `app/app.vue`. Component tests that mount panels outside Nuxt should stub the Nuxt UI controls and verify the panel's emitted intents and model updates.

### Mock APIs and shared variables

- Mock API entries target registered service endpoints. Endpoint route templates may contain `{name}`, `{name:constraint}`, or `:name` parameters; mock API path values are URL-encoded before outbound calls.
- Postman collection import accepts requests that match a registered REST endpoint by full URL and method. Mismatches are skipped and reported individually.
- Environment variables are project-scoped strings. References use `{{name}}` in JSON string values or path parameter values. Do not treat environment values as typed JSON.
- In the Mock APIs panel, **New variable** adds a blank card in edit mode. The panel's **Save** persists new variables, staged deletions, and mock API changes together. Existing variable cards have Edit/Delete icon actions; **Update** saves a changed name or value immediately and skips the PUT when neither changed.
- The request body uses CodeMirror 6 with JSON language support. GraphQL syntax support and chained mock calls are future work unless requirements are added.

### Runtime and validation

- Use `vp run db:generate` and `vp run db:migrate` for Drizzle schema changes. Add migration SQL and metadata together; preserve existing data when changing column types.
- Use `vp run dev`, `vp run build`, `vp check <changed paths>`, and `vp test run <test paths>` for development and focused validation.
- Docker Compose runs Cairn and MySQL on Cairn's network. `OUTBOUND_HOST_GATEWAY` rewrites container-side `localhost` targets to the host gateway so Cairn can call separately networked service projects through their published reverse proxies.
- Keep the OpenSpec change artifacts in sync when implementation behavior changes. Validate with `openspec validate service-graph-editor --strict`.
