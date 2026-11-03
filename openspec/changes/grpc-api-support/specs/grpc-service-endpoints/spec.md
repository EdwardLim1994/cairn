# Spec Delta

## Purpose

Lets users register REST and gRPC services in the graph, import unary gRPC methods from service schemas, and retain those schemas for mock calls.

## ADDED Requirements

### Requirement: Select API type for a service

The system SHALL let users set each service's API type to REST or gRPC, and SHALL apply that type to all endpoints on the service.

#### Scenario: Add a gRPC service

- **WHEN** a user creates a service and selects gRPC
- **THEN** the service and all imported endpoints are treated as gRPC
- **AND** a service using another API type is represented by a separate service node

#### Scenario: Edit API type on a service with endpoints

- **WHEN** a user changes a service API type
- **THEN** the system SHALL require the service endpoints to be valid for the selected type before saving

### Requirement: Import unary methods from a proto file

The system SHALL let users upload a self-contained `.proto` file for a gRPC service and add its unary methods to the service draft.

#### Scenario: Show protocol-specific import controls

- **WHEN** a user selects REST for a service
- **THEN** service settings show OpenAPI import and hide proto upload
- **WHEN** a user selects gRPC
- **THEN** service settings hide OpenAPI import and show proto upload below the target address

#### Scenario: Import unary methods

- **WHEN** a user uploads a valid `.proto` file containing unary methods
- **THEN** the system adds each method as a gRPC endpoint draft
- **AND** each endpoint identifies its fully qualified service method

#### Scenario: Skip streaming methods

- **WHEN** an uploaded proto file contains streaming methods
- **THEN** the system skips those methods
- **AND** informs the user that streaming methods are unsupported

#### Scenario: Reject imported dependencies

- **WHEN** a proto file references an unavailable imported file
- **THEN** the system reports the unresolved import
- **AND** leaves endpoint drafts unchanged

#### Scenario: Reject invalid proto file

- **WHEN** a user uploads a file that cannot be parsed
- **THEN** the system reports an import error
- **AND** leaves endpoint drafts unchanged

### Requirement: Preserve registered endpoints when proto file changes

The system SHALL add newly discovered methods without removing or changing existing endpoints or their graph connections.

#### Scenario: Upload an updated proto file

- **WHEN** a user uploads a valid updated proto file
- **THEN** the system adds methods that are not already registered
- **AND** preserves existing endpoints, names, and connections, including methods absent from the new file

#### Scenario: Skip a method already registered

- **WHEN** an imported method matches an existing endpoint by fully qualified method name
- **THEN** the system keeps the existing endpoint and its connections
- **AND** reports that the method was skipped as a duplicate

### Requirement: Persist the service proto file

The system SHALL persist each gRPC service's uploaded proto file and retain access to it after service settings are saved and the application restarts.

#### Scenario: Save a gRPC service

- **WHEN** a user saves a gRPC service with an uploaded proto file
- **THEN** the system associates the stored file with that service
- **AND** makes the file available to gRPC mock APIs targeting its endpoints

#### Scenario: Delete a gRPC service

- **WHEN** a user deletes a gRPC service
- **THEN** the system removes its stored proto file after the service is deleted

### Requirement: Configure gRPC target and TLS

The system SHALL let users configure a gRPC target address and choose whether the service uses TLS.

#### Scenario: Save gRPC target settings

- **WHEN** a user saves a gRPC service
- **THEN** the system validates and saves its host-and-port target and TLS setting

#### Scenario: Connect with TLS

- **WHEN** a gRPC service has TLS enabled
- **THEN** gRPC calls use TLS with default trusted certificate roots
- **AND** use custom certificate roots when configured by the deployment

### Requirement: Configure persistent proto storage

The system SHALL support local filesystem storage and S3-compatible storage for proto files, selected through environment configuration.

#### Scenario: Use local storage in Docker

- **WHEN** the application runs in Docker with local storage selected
- **THEN** proto files persist in a named volume across container restarts and replacements

#### Scenario: Use S3-compatible storage

- **WHEN** the application runs with S3 storage configured
- **THEN** proto files persist in the configured bucket using supplied endpoint, region, bucket, and credentials

### Requirement: Configure custom TLS certificate roots

The system SHALL allow a deployment to provide custom CA certificate roots for gRPC TLS connections.

#### Scenario: Mount a custom CA certificate

- **WHEN** a deployment mounts a CA PEM file and configures its path
- **THEN** TLS connections use that certificate as a trusted root

#### Scenario: Download a custom CA certificate at startup

- **WHEN** a deployment configures a CA certificate URL and expected SHA-256 checksum
- **THEN** Docker downloads the PEM file before starting the application
- **AND** verifies the checksum before exposing the file to the application
- **AND** does not start the application if download or checksum verification fails
