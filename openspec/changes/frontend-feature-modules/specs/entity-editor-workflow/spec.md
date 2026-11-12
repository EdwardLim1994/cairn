# Spec Delta

## Purpose

Provides predictable single-item create, update, and delete flows for workspace entities opened from panel cards or graph actions.

## ADDED Requirements

### Requirement: Cards open a single-item editor

The system SHALL open an item editor when an existing service, message queue, or mock API card is selected. Card selection SHALL NOT persist changes.

#### Scenario: Select existing card

- **WHEN** a user selects an existing item card
- **THEN** its edit view opens with original values and Update, Discard, and Delete actions

### Requirement: Create forms save one item

The system SHALL show Save and Discard actions for a new item and SHALL NOT show Delete.

#### Scenario: Save new item

- **WHEN** a user completes a valid create form and selects Save
- **THEN** the system creates that item, refreshes workspace data, returns to the card list, and shows a success toast that closes automatically

#### Scenario: Discard untouched create form

- **WHEN** a user discards or closes a create form without entering data
- **THEN** the system returns to the card list without a warning

#### Scenario: Discard entered create form

- **WHEN** a user discards or closes a create form after entering data
- **THEN** the system warns that unsaved changes will be lost and closes only after confirmation

### Requirement: Update forms protect changed data

The system SHALL compare an update form with the original item and SHALL warn before discarding changed values.

#### Scenario: Discard unchanged update form

- **WHEN** a user discards or closes an update form with values equal to the original item
- **THEN** the system returns to the card list without a warning

#### Scenario: Discard changed update form

- **WHEN** a user discards or closes an update form with changed values
- **THEN** the system warns that unsaved changes will be lost and closes only after confirmation

#### Scenario: Update item

- **WHEN** a user selects Update on a valid changed form
- **THEN** the system updates only that item, refreshes workspace data, returns to the card list, and shows a success toast that closes automatically

### Requirement: Deletion requires confirmation

The system SHALL offer Delete only for a saved item and SHALL request confirmation before deletion.

#### Scenario: Confirm deletion

- **WHEN** a user confirms deletion of a saved item
- **THEN** the system deletes that item, refreshes workspace data, returns to the card list, and shows a success toast that closes automatically

#### Scenario: Cancel deletion

- **WHEN** a user cancels the deletion warning
- **THEN** the item and current editor remain available

### Requirement: Failed mutation retains editing context

The system SHALL retain the editor and report a failure when a create, update, delete, or post-mutation refresh fails.

#### Scenario: Refresh fails after update

- **WHEN** an update succeeds but workspace refresh fails
- **THEN** the system reports the refresh failure and does not show a full-success toast
