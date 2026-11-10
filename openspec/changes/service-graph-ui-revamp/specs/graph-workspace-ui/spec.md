# Spec Delta

## Purpose

Defines how users navigate Cairn's graph workspace and reach configuration for service, message queue, and mock API nodes while retaining the graph as the primary view.

## ADDED Requirements

### Requirement: Workspace identity uses the configured project identifier

The workspace header SHALL identify the current project using `PROJECT_ID` and SHALL NOT display an environment or workspace name.

#### Scenario: Show the current project

- **WHEN** the graph workspace is open and `PROJECT_ID` is configured
- **THEN** the header displays that project identifier without an environment label

### Requirement: Primary configuration panels share one right-side drawer

Manage Nodes, Mock APIs, Run History, Graph as code, Access Tokens, and service or message queue configuration SHALL use the same right-side drawer shell. Logs SHALL remain in a separate bottom drawer.

#### Scenario: Switch primary panel views

- **WHEN** the user opens one of the primary configuration panels
- **THEN** its content appears in the shared right-side drawer
- **AND** opening another primary panel replaces the drawer content instead of stacking another drawer

#### Scenario: Open Logs

- **WHEN** the user opens Logs
- **THEN** Logs appears in the bottom drawer
- **AND** the right-side drawer remains independently available

### Requirement: Node manager lists services and individual message destinations

The node manager SHALL list each configured service and each Kafka topic or RabbitMQ topic exchange as an individual message queue entry, excluding mock API trigger nodes.

#### Scenario: List configured nodes

- **WHEN** the user opens Manage Nodes
- **THEN** the list contains each service and each message destination separately
- **AND** mock API triggers do not appear in the list

### Requirement: Each message queue entry represents one destination

Each message queue entry and graph node SHALL represent exactly one Kafka topic or RabbitMQ topic exchange with its own broker connection settings.

#### Scenario: Create a message queue destination

- **WHEN** the user selects Add queue and creates a valid Kafka topic or RabbitMQ topic exchange
- **THEN** Cairn creates one message queue entry and one graph node for that destination
- **AND** creating another destination requires another Add queue action
- **AND** Cairn does not create a shared settings page that manages several destinations together

### Requirement: Node manager navigates to configuration in the same drawer

Selecting a service or message queue entry SHALL show that item's configuration in the node-manager drawer and provide navigation back to the list.

#### Scenario: Open and return from node configuration

- **WHEN** the user selects a service or message queue entry
- **THEN** its configuration appears as a new page within the same right-side drawer
- **AND** a back action returns to the node list without closing the drawer

#### Scenario: Edit one destination from the graph

- **WHEN** the user activates Edit on a message queue graph node
- **THEN** the shared drawer opens the settings for that single topic or exchange

### Requirement: Graph node configuration requires an explicit Edit action

Clicking a graph node SHALL NOT open its configuration. Service, message queue, and mock API trigger nodes SHALL expose an Edit action that opens the corresponding configuration directly.

#### Scenario: Click a graph node

- **WHEN** the user clicks the body of a graph node
- **THEN** no configuration panel opens

#### Scenario: Edit a graph node

- **WHEN** the user activates Edit on a service node
- **THEN** its settings open in the shared drawer
- **WHEN** the user activates Edit on a mock API trigger node
- **THEN** the Mock APIs view opens focused on that API's configuration

### Requirement: Node creation is available from both the manager and graph context menu

The node manager SHALL provide Register service and Add queue actions, and existing graph context-menu actions for creating service and message queue nodes SHALL remain available.

#### Scenario: Create from the node manager or canvas

- **WHEN** the user starts creating a service or message queue from either entry point
- **THEN** Cairn opens the corresponding create form

### Requirement: Mock API cards follow Manage Nodes navigation

The Mock APIs drawer SHALL use regular clickable row cards for templates, variables, and mock APIs. These cards SHALL match Manage Nodes styling without accordion expansion.

#### Scenario: Open a setting from its card

- **WHEN** the user selects a mock API setting card
- **THEN** that setting's form opens in the same drawer
- **AND** the card does not expand inline

### Requirement: Mock API settings save per item

Creation or selection SHALL replace the list with that entity's form in the same drawer. Save SHALL persist only that entity and return to the list. Discard SHALL abandon its changes and return to the list.

#### Scenario: Create a mock API setting

- **WHEN** the user selects a New action for a template, variable, or mock API
- **THEN** the selected entity's creation form replaces the list in the drawer
- **WHEN** the user saves the valid form
- **THEN** Cairn persists the new entity and returns to the list

#### Scenario: Discard a mock API setting

- **WHEN** the user discards a new entity form or unsaved edits
- **THEN** Cairn returns to the list without persisting those changes

### Requirement: Mock API type is selectable

Mock API forms SHALL provide HTTP, gRPC, and WebSocket types and matching endpoint and request fields.

#### Scenario: Change the mock API type

- **WHEN** the user creates or edits a mock API and changes its type
- **THEN** the form updates its available endpoint and request fields to match that type

#### Scenario: Delete a mock API setting

- **WHEN** the user opens an existing mock API setting for editing
- **THEN** Delete is available in the drawer header and absent from its list card
- **WHEN** the user deletes a setting
- **THEN** Cairn removes that setting and returns to the list

### Requirement: Service settings return to node management

When a service form is opened from Manage Nodes, its header SHALL provide Back on the left and Delete on the right for existing services.

#### Scenario: Return from service settings

- **WHEN** the user opens an existing service from Manage Nodes
- **THEN** Back returns to the node list and Delete removes the service after confirmation

### Requirement: New node forms create or discard without saved drafts

New service, message queue, and mock API forms SHALL either create a complete item or discard the form without persisting a draft.

#### Scenario: Discard an incomplete new item

- **WHEN** the user discards a new service, message queue, or mock API form
- **THEN** Cairn closes the form without saving a draft or adding the item to the graph

#### Scenario: Create a new item

- **WHEN** the user submits a valid new service, message queue, or mock API form
- **THEN** Cairn persists the item and shows it in its relevant list or graph

### Requirement: The workspace adapts the supplied visual reference

The workspace SHALL apply the supplied design reference's visual structure and light and dark themes while retaining Cairn's existing graph operations and observability features.

#### Scenario: Use the workspace in either theme

- **WHEN** the user switches between light and dark themes
- **THEN** the workspace, graph nodes, drawers, and overlays use readable colors for the selected theme

### Requirement: Other services use the service-name mark

When a service uses the Other framework option, its graph node SHALL show the first two characters of the service name as its framework mark.

#### Scenario: Render an Other service node

- **WHEN** a service uses the Other framework option
- **THEN** its node displays the first two characters of the service name instead of a framework logo

### Requirement: Access-token management excludes operator login tokens

The access-token management UI SHALL manage OTLP ingestion access tokens only and SHALL NOT present an operator login token section.

#### Scenario: Open access-token management

- **WHEN** the user opens access-token management
- **THEN** the UI provides the OTLP access-token controls
- **AND** no operator login token section is shown

### Requirement: Access-token expiry matches the reference choices

OTLP access-token creation SHALL offer 7-day, 30-day, 90-day, and no-expiry choices. A no-expiry token SHALL remain valid until revoked, and its card SHALL display that it has no expiry.

#### Scenario: Create a token without an expiry

- **WHEN** the user creates an OTLP token with No expiry selected
- **THEN** Cairn stores it without an expiration timestamp
- **AND** it remains valid until revoked

### Requirement: Active observed trace appears after collection

After a mock API run finishes and Cairn has collected a complete trace containing spans, the workspace SHALL show an Active observed trace summary with trace ID, status, total duration, and observed connection count. It SHALL remain hidden when telemetry is missing or collection is incomplete.

#### Scenario: Show a completed observed trace

- **WHEN** a mock API run completes and its trace collection is complete with at least one span
- **THEN** the workspace shows the trace summary and a Logs action

#### Scenario: Hide unavailable trace data

- **WHEN** trace collection is incomplete or contains no spans
- **THEN** the Active observed trace summary remains hidden

### Requirement: Trigger responses remain beside their trigger nodes

The latest response panel SHALL remain positioned to the left of its trigger node at desktop and mobile viewport sizes.

#### Scenario: Open a response on a narrow viewport

- **WHEN** a trigger node response panel is opened on a mobile viewport
- **THEN** the panel appears to the left of that trigger node using the same placement behavior as desktop

### Requirement: Logs dock follows the reference controls

The bottom Logs dock SHALL show the log count, active-trace-only checkbox, active trace chip when available, All/Info+/Warn+ severity controls, text/service search, and close action. Log rows SHALL show timestamp, severity, service, message, and short trace ID.

#### Scenario: Filter logs by active trace and level

- **WHEN** the user enables Active trace only or chooses a severity preset
- **THEN** the log list is filtered using the active trace ID and selected severity set
- **AND** the dock remains independently closable from the workspace drawer
