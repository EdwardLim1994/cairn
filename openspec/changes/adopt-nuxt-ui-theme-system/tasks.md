# Tasks

## 1. Shared color mode

- [x] 1.1 Replace the workspace cookie boolean and manual HTML classes with Nuxt color-mode state; migrate legacy true/false choices once without overwriting newer preferences. Verify focused tests cover both values, absent/invalid cookies, existing system/light/dark preferences, repeat startup, and unavailable storage.
- [x] 1.2 Add UColorModeButton to login and toolbar and derive graph mode from the shared resolved value; verify route changes and reloads retain explicit choices and fresh users follow system mode, with focused component tests for mode consumers.

## 2. Defaults and shared controls

- [x] 2.1 Consolidate semantic palette assignments and necessary component defaults in app.config.ts using installed generated themes; remove redundant focus/size/spacing overrides and verify shared-control tests still cover dismissal and emitted actions.
- [x] 2.2 Migrate shared drawers, accordions, login, and toolbar to semantic utilities and default control spacing; verify drawer bounds, scrolling, login actions, and toolbar actions remain usable while graph geometry stays fixed.
- [x] 2.3 Update AGENTS.md and app/ARCHITECTURE.md styling guidance to describe Nuxt UI defaults, built-in color mode, and limited integration CSS; verify examples match the implemented configuration.

## 3. Feature panels and integrations

- [x] 3.1 Remove redundant styling overrides and legacy generic token references from feature panels and forms; verify focused panel tests preserve validation, save/discard protection, deletion confirmation, and emitted intents with Nuxt UI stubs where needed.
- [x] 3.2 Map graph, protocol badges, and editor integration colors to semantic tokens or justified theme-aware palettes while preserving node dimensions and handle offsets; verify graph tests cover selection clearing, gradients, timing, message states, and runtime stroke behavior.
- [x] 3.3 Remove superseded Cairn palette definitions, aliases, app--dark selectors, and generic global rules after migrating consumers; verify targeted searches find no remaining obsolete references and retain only necessary imports/integration rules.

## 4. Integration verification

- [x] 4.1 Run focused vp check and vp test commands for changed paths, vp run build, and openspec validate adopt-nuxt-ui-theme-system --strict; record results and resolve failures.
- [x] 4.2 Provide a runnable application and a concise review checklist covering login/workspace modes, drawers with default spacing, and graph selection/mock execution; deliver the look-and-feel review to the user without claiming visual approval.

## Validation and review handoff

- Frontend suite: 48 files, 237 tests passed. Focused migration, shared-card, and toolbar tests also passed after final edits.
- `vp check app nuxt.config.ts`, `vp run build`, and strict OpenSpec validation passed. Production bundling still reports existing backend circular-export and dependency deprecation warnings.
- Source dev server: http://localhost:3005 (HTTP 200). Current environment disables authentication, so /login redirects to the workspace.
- User review: switch modes and reload; inspect forms, accordions, drawer spacing and scrolling; select and clear graph nodes; trigger a Mock API and inspect observed lines and timing. Review the login form when operator authentication is enabled.
- Delivery of this checklist completes the handoff task; visual approval remains with the user.
