# Spec Delta

## Purpose

Lets users configure raw WebSocket messages, manage persistent connections from graph trigger nodes, and inspect incoming backend messages.

## ADDED Requirements

### Requirement: Configure a WebSocket mock API

The system SHALL let users create a WebSocket mock API that targets a registered WebSocket endpoint and contains a text message to send.

#### Scenario: Create a WebSocket mock API

- **WHEN** a user creates a WebSocket mock API
- **THEN** only registered WebSocket endpoints are available as targets
- **AND** the user can enter the text message that Trigger will send

#### Scenario: Require a target and request message

- **WHEN** a WebSocket mock API has no target endpoint or its request message is empty
- **THEN** the mock API is not ready to connect or trigger
- **AND** Cairn identifies the missing configuration

#### Scenario: Configure connection authorization and headers

- **WHEN** a WebSocket mock API uses an authorization template or custom headers
- **THEN** Cairn applies them to the WebSocket connection handshake

### Requirement: Connect WebSocket mock APIs from graph trigger nodes

The system SHALL provide Connect and Trigger actions on WebSocket mock API trigger nodes, with Trigger available only while the connection is established.

#### Scenario: Establish a WebSocket connection

- **WHEN** a user selects Connect for a ready WebSocket mock API
- **THEN** Cairn opens a persistent connection to its target endpoint
- **AND** enables Trigger only after the connection is established

#### Scenario: Retry an initial connection failure

- **WHEN** an initial WebSocket connection attempt fails
- **THEN** Cairn retries the connection a limited number of times
- **AND** shows an error toast if the retries do not establish a connection

#### Scenario: Reject a competing session on the same endpoint

- **WHEN** a user attempts to connect another WebSocket mock API to an endpoint with an active session
- **THEN** Cairn rejects the new connection attempt
- **AND** tells the user to disconnect the active session first

#### Scenario: Allow sessions to different endpoints

- **WHEN** WebSocket mock APIs target different endpoints
- **THEN** each endpoint can have its own active connection

#### Scenario: Confirm an intentional disconnect

- **WHEN** a user selects Disconnect for an active WebSocket session
- **THEN** Cairn asks the user to confirm closing the connection
- **AND** keeps the session active if the user cancels
- **AND** closes the session if the user confirms

#### Scenario: Handle an established connection drop

- **WHEN** an established WebSocket session closes unexpectedly
- **THEN** Cairn marks the session disconnected and disables Trigger
- **AND** does not reconnect automatically

### Requirement: Send configured text messages over an active session

The system SHALL send the configured WebSocket mock API text message when the user selects Trigger on an established session.

#### Scenario: Trigger a connected WebSocket mock API

- **WHEN** a user selects Trigger while the WebSocket session is connected
- **THEN** Cairn sends the configured text message over that session

#### Scenario: Prevent triggering before connection

- **WHEN** the WebSocket session is not connected
- **THEN** Trigger is disabled and no message is sent

### Requirement: Display incoming WebSocket messages

The system SHALL show incoming backend messages in the WebSocket mock API response panel without displaying outgoing messages.

#### Scenario: Receive messages while the response panel is open

- **WHEN** backend messages arrive for a connected WebSocket mock API
- **AND** its response panel is open
- **THEN** Cairn displays the incoming messages in that panel

#### Scenario: Indicate messages received while the panel is hidden

- **WHEN** backend messages arrive while the mock API response panel is hidden
- **THEN** Cairn indicates on the trigger node that new responses are available

#### Scenario: Clear the unread indication

- **WHEN** a user opens the response panel for a WebSocket mock API
- **THEN** Cairn clears that mock API's unread response indication

#### Scenario: Show only one response panel

- **WHEN** a user opens the response panel for another mock API
- **THEN** Cairn closes the previously displayed response panel
- **AND** opening or closing a panel does not change any WebSocket connection state
