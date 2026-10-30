# Proposal

## Why

The application page currently combines graph rendering, shared state, settings workflows, mock API execution, and log handling, while server routes mix HTTP handling, business workflows, and Drizzle queries. This makes changes difficult to isolate and test; introducing clear boundaries now will make future debugging and feature work more maintainable without changing product behavior.

## What Changes

- Extract the frontend page into focused view components and adopt MVVM boundaries for UI state and actions.
- Add Pinia stores for shared frontend state used across child components.
- Define shared Zod request and response schemas so frontend and backend use and validate the same API contracts.
- Refactor Nuxt route handlers into thin controllers, with one use case per endpoint and domain repositories for persistence.
- Migrate incrementally by vertical slice, preserving existing behavior and adding unit and integration tests for every production method, component, endpoint, and feature flow.

## Capabilities

### New Capabilities

None. This is a structural refactor and introduces no new user-visible behavior.

### Modified Capabilities

None. Existing product requirements remain unchanged.

## Impact

- Frontend: `app/app.vue`, extracted components, Pinia stores, API clients, shared API schemas, and tests.
- Backend: `server/api`, new use-case and repository modules, and exhaustive unit and integration tests around every endpoint workflow and persistence boundary.
- Verification: a maintained coverage inventory for production methods, components, endpoints, and user-facing feature flows.
- Dependencies: Pinia and its Nuxt integration, plus Zod.
- API behavior, database schema, and persisted data remain compatible.
