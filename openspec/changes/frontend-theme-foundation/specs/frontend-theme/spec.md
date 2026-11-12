# Spec Delta

## Purpose

Defines consistent light and dark appearance for Cairn's shared controls and surfaces while preserving workspace layout and interactions.

## ADDED Requirements

### Requirement: Consistent theme across shared surfaces

The system SHALL apply the selected light or dark palette consistently to shared controls, cards, and side drawers.

#### Scenario: Light theme

- **WHEN** a user views the workspace in light mode
- **THEN** shared controls, cards, and side drawers use the light palette consistently

#### Scenario: Dark theme

- **WHEN** a user switches to dark mode
- **THEN** shared controls, cards, and side drawers use the dark palette consistently without requiring a reload

### Requirement: Consistent shared control styling

The system SHALL present equivalent controls with consistent spacing, sizing, colors, and interactive states throughout the workspace.

#### Scenario: Equivalent actions in different panels

- **WHEN** a user views equivalent actions in service, queue, and mock API panels
- **THEN** those actions have consistent control styling and visible interaction states

### Requirement: Stable workspace layout and behavior

The system SHALL preserve panel placement, button placement, graph behavior, and existing save and dismissal behavior during theme foundation migration.

#### Scenario: Opening a side drawer

- **WHEN** a user opens an existing side drawer after the migration
- **THEN** it appears in the same workspace position and retains its existing interaction behavior
