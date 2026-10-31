# Spec Delta

## Purpose

Protects panel state and unfinished edits from accidental outside clicks while retaining deliberate close, Save, and Discard interactions.

## ADDED Requirements

### Requirement: Outside clicks do not dismiss application panels

All application panels, including Service settings, Mock APIs settings, Logs, and Latest run details, SHALL remain open when users click outside their content. Outside clicks SHALL NOT discard edits, persist changes, or reset panel state. This behavior SHALL NOT prevent normal dismissal of transient menus, selects, or confirmation dialogs.

#### Scenario: Preserve unfinished settings

- **WHEN** a user edits a Service or Mock APIs panel and clicks its backdrop or another outside area
- **THEN** the panel remains open and all unsaved fields, imported cards, header rows, template associations, and activation edits remain intact

#### Scenario: Preserve read-only panel state

- **WHEN** a user clicks outside the Logs or Latest run panel
- **THEN** the panel stays open with its filters, selected content, and displayed data unchanged by dismissal

### Requirement: Preserve deliberate panel controls

The system SHALL retain explicit close, Save, Discard, and existing Escape behavior where supported. Preventing outside-click dismissal SHALL NOT disable accessible keyboard operation or ordinary input interactions.

#### Scenario: Deliberate save or discard

- **WHEN** a user invokes an explicit panel Save, Discard, or close action
- **THEN** the panel follows that action's existing persistence and dismissal behavior

#### Scenario: Keyboard behavior remains available

- **WHEN** a user navigates controls by keyboard or presses Escape in a panel that already supports Escape dismissal
- **THEN** the existing keyboard behavior continues to work
