# Spec Delta

## Purpose

Provide consistent application styling and color-mode preferences across authentication, workspace controls, and graph integrations.

## ADDED Requirements

### Requirement: Application controls share default styling

Generic controls and panels SHALL use the shared UI system's default sizing, padding, and spacing. Local overrides SHALL be limited to necessary layout or domain behavior.

#### Scenario: Open workspace panels

- **WHEN** a user opens a form, accordion, or drawer
- **THEN** its generic controls use consistent shared defaults
- **AND** editing, validation, scrolling, and dismissal remain functional

### Requirement: Color mode follows a shared preference

Login and workspace pages SHALL share one persistent color-mode preference. Without an explicit preference, the application SHALL follow the system mode. Both pages SHALL provide a mode toggle.

#### Scenario: First visit

- **WHEN** a visitor has no saved explicit preference
- **THEN** the application follows the system light or dark mode

#### Scenario: Choose a mode

- **WHEN** a user changes mode on login or workspace
- **THEN** that explicit choice applies across both pages and subsequent visits

### Requirement: Existing explicit preferences survive migration

The application SHALL migrate a valid existing light/dark preference once when no preference exists in the new system. A newer preference SHALL take priority. Missing or invalid legacy values SHALL fall back to system mode.

#### Scenario: Migrate a previous choice

- **WHEN** a valid legacy choice exists and no new preference exists
- **THEN** that choice becomes the shared preference
- **AND** the legacy preference is retired after successful migration

#### Scenario: Preserve a newer choice

- **WHEN** both preference formats exist
- **THEN** the newer preference wins and migration does not overwrite it

### Requirement: Graph meaning and geometry survive theme adoption

Theme adoption SHALL preserve graph card dimensions, connection handle alignment, and interaction behavior. Selection, related nodes, observed calls, message links, health, and errors SHALL remain distinguishable in both modes using semantic theme colors.

#### Scenario: Inspect graph relationships and execution

- **WHEN** a user selects a service or triggers a Mock API in either mode
- **THEN** graph emphasis, timing, and execution states retain their existing meanings and behavior
- **AND** connections remain aligned to their handles
- **AND** clearing selection removes relationship styling while preserving observed telemetry styling
