# Spec Delta

## Purpose

Lets users register raw WebSocket services and endpoints in Cairn so WebSocket mock APIs can target them from the service graph.

## ADDED Requirements

### Requirement: Register a WebSocket service

The system SHALL let users select WebSocket as a service API type and register one or more WebSocket endpoints for that service.

#### Scenario: Configure a WebSocket service

- **WHEN** a user selects WebSocket for a service
- **THEN** the service editor accepts WebSocket endpoint addresses using `ws://` or `wss://`
- **AND** the endpoints are available to WebSocket mock APIs

#### Scenario: Reject an invalid WebSocket endpoint address

- **WHEN** a user saves a WebSocket service with an endpoint that is not a valid `ws://` or `wss://` address
- **THEN** the service is not saved
- **AND** the endpoint field reports a validation error

#### Scenario: Preserve other service API types

- **WHEN** a user creates or edits a REST, GraphQL, or gRPC service
- **THEN** its existing service and endpoint behavior remains available
