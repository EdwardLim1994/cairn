# Spec Delta

## Purpose

Defines a readable YAML text format for editing Cairn graph configuration without changing the graph's validated data model or saved runtime behavior.

## ADDED Requirements

### Requirement: Graph as code is displayed and exported as YAML

The Graph as code editor SHALL serialize the current graph manifest as YAML and SHALL accept YAML documents for validation and application.

#### Scenario: Open Graph as code

- **WHEN** the user opens Graph as code
- **THEN** the current graph manifest is displayed as YAML text

#### Scenario: Apply valid YAML

- **WHEN** the user applies a valid YAML graph manifest
- **THEN** Cairn validates it against the graph manifest rules and applies the resulting graph

### Requirement: Graph as code preserves JSON document compatibility

The Graph as code editor SHALL continue accepting existing JSON graph manifests as valid YAML-compatible input.

#### Scenario: Apply an existing JSON manifest

- **WHEN** the user applies a valid JSON graph manifest
- **THEN** Cairn parses and validates it using the same manifest rules as YAML input

### Requirement: Invalid graph code does not partially update the graph

The editor SHALL report YAML or manifest validation errors and SHALL leave the saved graph unchanged when the document is invalid.

#### Scenario: Apply invalid YAML or manifest data

- **WHEN** the user applies malformed YAML or a document that fails manifest validation
- **THEN** Cairn reports the error
- **AND** the graph remains unchanged
