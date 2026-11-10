# Tasks

## 1. Shared workspace drawer and navigation

- [x] 1.1 Build one right-side drawer shell for Manage Nodes, Mock APIs, Run History, Graph as code, Access Tokens, and node settings; verify switching views does not stack drawers.
- [x] 1.2 Keep Logs in a separate bottom drawer and verify it can be opened independently of the right-side drawer.
- [x] 1.3 Add the `PROJECT_ID` header chip without workspace or environment labels; verify the missing-ID state omits the chip.
- [x] 1.4 Add the Manage Nodes list for services and individual message destinations, with Register service and Add queue actions; preserve graph context-menu creation and verify both entry points.
- [x] 1.5 Add direct Edit actions to service, message queue, and mock API trigger nodes; verify node-body clicks do not open settings and existing drag, edge, collapse, and WebSocket controls still work.
- [x] 1.6 Implement create-or-discard forms for new services, destinations, and mock APIs; verify discarding persists nothing and creating adds a complete item.
- [x] 1.7 Add or update component and page tests for drawer navigation, manager actions, Edit routing, and create/discard behavior; verify with focused `vp test` paths.

## 2. Per-destination message queue nodes

- [x] 2.1 Render one message queue graph node per Kafka topic or RabbitMQ topic exchange, keyed by destination ID; verify each node shows only its own destination and connections.
- [x] 2.2 Update canvas position persistence to store positions per destination and convert or fall back from existing queue-group positions; verify reload preserves every destination and its producer/subscriber connections.
- [x] 2.3 Replace grouped queue settings with a single-destination create/edit form containing broker type, connection settings, and topic/exchange name; verify Add queue creates exactly one destination and no shared multi-topic settings page exists.
- [x] 2.4 Remove partition, retention, and exchange durability controls from the message queue UI; verify no broker metadata or topology provisioning is implied.
- [x] 2.5 Add or update graph, settings, persistence, and migration tests for multiple destinations previously sharing one queue ID; verify no topics or message connections are lost.

## 3. Fixed service health polling

- [x] 3.1 Change page-bound health polling to a fixed 60-second cadence for all services and stop the timer when the page unmounts; verify cadence and cleanup with focused tests.
- [x] 3.2 Track each service's most recent completed health-check time in session state; verify successful and failed checks both update the timestamp and no database field is added.
- [x] 3.3 Show “Checks every 1 minute” and last-check age only in service settings; verify graph nodes continue showing health state without elapsed age.

## 4. YAML Graph as code

- [x] 4.1 Add YAML parsing/stringifying and CodeMirror YAML syntax support; verify dependency installation and editor syntax highlighting.
- [x] 4.2 Serialize the current graph as YAML and parse YAML or compatible JSON into the existing validated manifest; verify round-trip, legacy JSON, malformed YAML, and invalid manifest cases.
- [x] 4.3 Verify invalid documents leave the saved graph unchanged and expose useful parse/schema errors through Graph as code panel tests.

## 5. Apply the updated visual reference

- [x] 5.1 Refresh the toolbar, graph workspace, shared drawer, service/message queue/trigger nodes, and status styling from `C:\Users\User\Downloads\Cairn\Main.dc.html`; verify light and dark themes.
- [x] 5.2 Keep the service framework label `Other` and render its two-character service-name mark; verify Other services do not show a fabricated framework logo.
- [x] 5.3 Adapt Access Tokens to the reference while omitting operator login tokens; verify OTLP token creation, one-time reveal, expiry, and revocation remain available.
- [x] 5.4 Verify responsive layouts preserve response panels, trace/timing labels, run history, Logs bottom drawer, WebSocket controls, and existing graph actions with focused regression tests.
- [x] 5.5 Group repeated outbound rows by destination while preserving endpoint-level connections, and render each observed service-pair timing label once.

## 6. Integration verification

- [x] 6.1 Run `openspec validate service-graph-ui-revamp --strict` and resolve specification errors.
- [x] 6.2 Run focused UI, health, message graph, and Graph as code tests plus the project check/build commands; record any remaining failures or environment limitations.

## 7. Complete visual-reference details

- [x] 7.1 Keep trigger response panels to the left of their nodes at desktop and mobile sizes, and keep run controls and duration on one row.
- [x] 7.2 Match Kafka publish telemetry using observed service, topic, and publish-operation attributes so matching message connections animate.
- [x] 7.3 Map Cairn theme tokens through Tailwind v4 `@theme inline` and set a consistent default Nuxt UI button size.
- [x] 7.4 Use framework and broker icons in Manage Nodes, provide a return action for service creation, and separate service edit/collapse controls.
- [x] 7.5 Match Logs dock controls and rows to the reference and show Active observed trace only after complete trace collection.
- [x] 7.6 Match service, message queue, trigger, settings, and access-token typography/spacing to the reference; add 7/30/90-day and no-expiry token choices.
- [x] 7.7 Make Manage Nodes, Run History, Mock APIs, Graph as code, and Logs toolbar actions visibly active and toggle their panels on repeated clicks.

## 8. Mock API settings create/edit navigation

- [x] 8.1 Replace inline card editing with in-drawer forms for header templates, authorization templates, environment variables, and mock APIs; verify card selection opens the corresponding editor.
- [x] 8.2 Add per-entity Save and Discard actions that persist only the selected entity and return to the list; preserve import and staged deletion behavior.
- [x] 8.3 Keep request JSON editable as formatted text when opening existing mock APIs and retain authorization type-specific fields.
- [x] 8.4 Replace per-type New API actions with one New API button and provide an HTTP, gRPC, and WebSocket selector in create and edit forms.
- [x] 8.5 Use Manage Nodes style clickable row cards for all Mock APIs panel items and navigate to edit forms instead of expanding accordions.
- [x] 8.6 Remove delete actions from Mock APIs list cards, add delete to each existing item's edit header, and place Back in the left side of Mock APIs and service-setting headers.
