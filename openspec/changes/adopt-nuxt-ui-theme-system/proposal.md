# Proposal

## Why

Cairn duplicates Nuxt UI's theme management through custom palettes, color-mode state, and repeated control overrides. Adopting the library's defaults will make controls and panels consistent and reduce styling maintenance.

## What Changes

- Adopt Nuxt UI default control sizing, padding, and spacing across login, toolbar, forms, and panels; remove redundant local overrides.
- Centralize shared component defaults and semantic palette assignments in app.config.ts. Allow additional semantic roles backed by existing palettes when a distinct meaning requires them.
- Use built-in color-mode controls on login and workspace, follow system mode initially, and migrate existing explicit cookie preferences once.
- Replace Cairn's duplicate palette with Nuxt UI semantic utilities and tokens. Preserve graph dimensions, handle alignment, and the meanings of selection, related nodes, observed calls, messages, health, and errors.
- Keep integration CSS only where graph/editor behavior requires it. User reviews the resulting look and feel.

## Capabilities

### New Capabilities

- `application-theme`: Consistent semantic styling and persistent color-mode selection across login and workspace.

### Modified Capabilities

None. No durable specs currently exist.

## Impact

- app/app.vue, app/app.config.ts, nuxt.config.ts, login and workspace pages, toolbar, shared controls, feature panels, graph/editor integrations, and their focused tests.
- Update repository styling guidance to reflect Nuxt UI ownership of defaults.
- No backend API, database, or graph persistence changes. Use the installed Nuxt UI 4.12 capabilities.
