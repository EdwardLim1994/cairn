# Spec Delta

## Purpose

Lets users understand service health freshness while Cairn periodically checks services during an open graph session.

## ADDED Requirements

### Requirement: Cairn polls service health every minute while the page is open

Cairn SHALL schedule health-check refreshes for all configured services every 60 seconds while the graph page is mounted and SHALL stop scheduled checks when the page is unmounted.

#### Scenario: Poll services during an open session

- **WHEN** the graph page remains open
- **THEN** Cairn refreshes service health on a 60-second cadence

#### Scenario: Stop polling after leaving the page

- **WHEN** the graph page is unmounted
- **THEN** Cairn stops its scheduled service health checks

### Requirement: Service settings show the fixed health polling interval

Service settings SHALL state that health checks run every one minute and SHALL NOT expose a per-service interval control.

#### Scenario: View health polling interval

- **WHEN** the user opens a service's settings
- **THEN** the settings show that health checks run every one minute
- **AND** they do not offer a per-service polling interval selector

### Requirement: Service settings show last-check age

Service settings SHALL show elapsed time since the most recent completed health-check attempt for that service.

#### Scenario: Show age of a completed attempt

- **WHEN** a health-check attempt has completed for a service
- **THEN** its settings display how many seconds ago the check completed, whether it succeeded or failed

#### Scenario: No check has completed in this session

- **WHEN** no health-check attempt has completed for a service in the current session
- **THEN** its settings indicate that it has not been checked yet

### Requirement: Graph health indicators omit last-check age

Service graph nodes SHALL show their health state without displaying last-check age.

#### Scenario: Keep graph health status compact

- **WHEN** a service node is shown on the graph
- **THEN** it shows its health state
- **AND** it does not show elapsed time since the last check
