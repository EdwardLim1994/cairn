# Spec Delta

## Purpose

Lets users define service nodes and endpoint-level calls in JSON code, then apply that definition to the visual graph. It keeps service configuration independent from graph position.

## ADDED Requirements

### Requirement: Users can edit service graph code

The system SHALL provide a right-side Graph as code panel with an editor for service graph JSON.

#### Scenario: Open code editor for an empty graph

- **WHEN** a user opens Graph as code while no services exist
- **THEN** the editor starts empty

#### Scenario: Open code editor for an existing graph

- **WHEN** a user opens Graph as code while services exist
- **THEN** the editor contains code representing the current service graph

#### Scenario: Discard code edits

- **WHEN** a user edits graph code and selects Discard
- **THEN** the system discards the editor changes and keeps the current graph

### Requirement: Users can import a service graph definition

The system SHALL let users import a JSON file into the code editor and apply service nodes, endpoints, and endpoint-level outbound connections from that definition.

#### Scenario: Import a graph file into an empty graph

- **WHEN** a user imports a valid graph JSON file
- **THEN** the system loads its contents into the editor without changing the graph
- **AND** the user can review or edit the code before selecting Apply

#### Scenario: Apply service graph code

- **WHEN** a user selects Apply with valid graph code
- **THEN** the system replaces the current service graph with the code's services, endpoints, and outbound connections
- **AND** the system leaves Mock API trigger definitions outside the imported graph code

#### Scenario: Import omits layout coordinates

- **WHEN** a user applies graph code
- **THEN** the graph code does not require node coordinates
- **AND** the system assigns node positions separately from service details

#### Scenario: Apply to an empty graph

- **WHEN** a user applies valid graph code to a graph with no services
- **THEN** the system assigns positions through automatic graph layout

#### Scenario: Apply to an existing graph

- **WHEN** a user applies valid graph code to a graph with existing services
- **THEN** the system preserves positions for matching service keys
- **AND** the system places new services in available positions without rearranging existing services

### Requirement: Graph code uses stable service and endpoint keys

The system SHALL persist stable keys for imported services and endpoints so code can reference services and endpoint-level calls independently of display names and generated database IDs.

#### Scenario: Resolve an outbound target

- **WHEN** an endpoint's outbound connection names a target service key and endpoint key
- **THEN** the system connects the source endpoint to the matching target endpoint

#### Scenario: Reject a missing outbound target

- **WHEN** an outbound connection references an unknown service key or endpoint key
- **THEN** the system rejects Apply and reports the invalid reference

### Requirement: Graph code validates fixed service and endpoint fields

The system SHALL validate graph code fields against supported service and endpoint values before Apply.

#### Scenario: Validate service and endpoint values

- **WHEN** graph code contains an unsupported framework, API type, HTTP method, or malformed field value
- **THEN** the system reports the field error and does not change the current graph

#### Scenario: Reject clashing keys

- **WHEN** graph code contains duplicate service keys or duplicate endpoint keys within one service
- **THEN** the system reports the duplicate key and does not change the current graph

#### Scenario: Reject duplicate outbound connections

- **WHEN** one endpoint lists the same target endpoint more than once
- **THEN** the system reports the duplicate connection and does not change the current graph

#### Scenario: Suggest fixed field values

- **WHEN** a user edits a framework, API type, or HTTP method value
- **THEN** the editor suggests the supported values for that field

### Requirement: Graph code supports service health-check configuration

The system SHALL let graph code optionally define a service health-check URL and its headers.

#### Scenario: Apply health-check details

- **WHEN** valid graph code defines a health-check object with a URL and header rows
- **THEN** the system applies the health-check configuration to that service
- **AND** the health-check object may be omitted

### Requirement: Invalid graph code does not partially apply

The system SHALL keep the current graph unchanged when graph code fails syntax, schema, key, reference, or persistence validation.

#### Scenario: Reject invalid JSON

- **WHEN** the editor contains malformed JSON and a user selects Apply
- **THEN** the system reports a syntax error and leaves the current graph unchanged

#### Scenario: Reject a failed graph save

- **WHEN** server-side validation or persistence fails while applying graph code
- **THEN** the system reports the failure and leaves the saved graph unchanged
