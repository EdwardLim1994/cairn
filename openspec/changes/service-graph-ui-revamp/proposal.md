# Proposal

## Why

Cairn's graph is the main workspace, but configuration is spread across separate panels and message destinations are difficult to manage. The updated design reference brings node management and the main configuration panels into a consistent workspace while making each message topic or exchange a distinct graph item.

## What Changes

- Revamp the workspace using `C:\Users\User\Downloads\Cairn\Main.dc.html` as a visual reference, adapting it to Cairn's existing behavior.
- Show `PROJECT_ID` in the header without an environment or workspace label.
- Use one right-side drawer for Manage Nodes, Mock APIs, Run History, Graph as code, Access Tokens, and service/message queue configuration. Keep Logs in a separate bottom drawer.
- Provide a Manage Nodes header action listing service nodes and individual message queue destinations. Exclude mock API triggers. Include Register service and Add queue actions, while retaining graph context-menu node creation.
- Represent each Kafka topic or RabbitMQ topic exchange as its own message queue entry and graph node, with its own broker connection settings. Creating another topic requires another Add queue action; there is no grouped broker settings page.
- Add Edit actions to service, message queue, and mock API trigger nodes. Clicking a node body does not open settings.
- Make new service, message queue, and mock API flows create-or-discard; do not save drafts.
- Poll all service health checks every 60 seconds while the graph page is open. Show the fixed interval and last-check age in service settings only.
- Use YAML for Graph as code text parsing and serialization while retaining the existing graph manifest and API data model.
- Follow the reference's access-token layout for OTLP ingestion tokens, omitting its operator login token section. Do not add Kafka partition/retention or RabbitMQ durability metadata.

## Capabilities

### New Capabilities

- `graph-workspace-ui`: Workspace shell, node management, per-destination graph items, and editing entry points.
- `service-health-status`: Fixed health polling cadence and last-check age.
- `graph-as-code-yaml`: YAML-based Graph as code editing and compatibility behavior.

### Modified Capabilities

None. The repository has no main `openspec/specs/` capabilities yet; these requirements are introduced as new capabilities.

## Impact

The UI affects the graph page, toolbar, service and message queue nodes, and settings panels. Message destination rendering and position persistence will change from queue-grouped nodes to one node per destination while preserving destination configuration and producer/subscriber connections. Health polling changes from a 10-second page timer to a fixed 60-second page-bound timer; last-check timestamps are session-local and require no service API or database field. Graph as code text changes from JSON to YAML while preserving the validated manifest object and API payload.
