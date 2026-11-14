# Tasks

## 1. FSD foundation and workspace data

- [x] 1.1 Establish FSD layers, slice public APIs, and import boundaries after `frontend-theme-foundation`; verify moved files resolve with `vp check` and `vp run build`.
- [x] 1.2 Move shared service, message destination, and mock API data to one owning entity store each while retaining full canvas bootstrap; move related tests into each slice's `_test_` and verify focused store tests.
- [x] 1.3 Derive graph nodes and panel cards from canonical entity data and preserve viewport and observed-run state on refresh; verify graph and canvas tests under `_test_`.

## 2. Manage-node editors

- [x] 2.1 Move manage-nodes widget and service/queue editor features into FSD slices; make graph controls emit edit intents and verify focused component tests under `_test_`.
- [x] 2.2 Implement single-item Create, Update, Discard, Close, and Delete behavior for service and queue editors; verify untouched, changed, canceled, and confirmed paths with focused tests.
- [x] 2.3 Reload canvas after successful service/queue mutations, return to card list, and show automatically closing success toasts; verify refresh failure retains context and does not show full success.

## 3. Graph and mock API slices

- [x] 3.1 Move graph canvas and all graph node types into a graph widget, including trigger-node response panel; verify observed timing, endpoint highlighting, response focus, and graph event tests in `_test_`.
- [x] 3.2 Move mock API cards, editors, execution, and WebSocket session handling into FSD slices; remove batch Save and verify single-item CRUD, run, and session tests in `_test_`.
- [x] 3.3 Make mock API updates refresh canonical canvas data and show success only after refresh; verify card and graph projections stay in sync with focused tests.

## 4. Deferred panels and page coordination

- [x] 4.1 Load closed panel UI on demand while keeping toolbar, graph canvas, and all node types on initial path; verify initial render and first-open loading in focused tests.
- [x] 4.2 Defer logs, history, and other panel-only fetches until open while keeping graph health polling active; verify no panel-only fetch on initial load and correct fetch on open.
- [x] 4.3 Reduce `index.vue` to bootstrap and cross-slice event wiring, move remaining tests into owning `_test_` directories, and verify route-level behavior with `vp test run` and `vp check`.

## 5. Integration checks

- [x] 5.1 Run full relevant frontend tests, `vp check`, `vp run build`, and `openspec validate frontend-feature-modules --strict`; verify light/dark, narrow/desktop, and graph telemetry behavior remain correct.

## 6. Workspace adjustments

- [x] 6.1 Open drawers on the right, move timing labels near outbound connections, and keep the graph legend clear of controls and instructions.
- [x] 6.2 Gate the app by operator session, rerender after login, and hide Sign out when authentication is disabled.
- [x] 6.3 Show header and authorization templates in independently collapsible sections.
- [x] 6.4 Keep every drawer within shared viewport gaps below the toolbar.
