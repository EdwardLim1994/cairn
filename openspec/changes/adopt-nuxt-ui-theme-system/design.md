# Design

## Context

See proposal.md. Nuxt UI 4.12 and UApp are already installed. app.config.ts defines semantic palettes and focus overrides, but app.vue owns a parallel light/dark palette, aliases, resets, and integration selectors. index.vue persists cairn-dark-mode and sets HTML classes manually. The completed frontend-theme-foundation design retained this palette; this change deliberately supersedes that approach. Graph relationship highlighting remains an active change and its behavior must be preserved.

## Goals / Non-Goals

**Goals:** Make Nuxt UI own generic appearance and color-mode state; remove duplicate theme ownership while retaining domain behavior and graph geometry.

**Non-Goals:** Exact old hex values or screenshot parity, graph layout changes, backend changes, additional theme frameworks, or automatic visual approval.

## Decisions

### Use Nuxt UI semantic palettes and generated defaults

Keep palette assignments and necessary shared component configuration in app.config.ts. Inspect generated themes before removing repeated ui/class overrides. Prefer library defaults, including spacing; use defaultVariants only for deliberate shared differences. Use UTheme only where a real subtree default is needed. Replace generic token references with semantic utilities. Retain necessary integration selectors consuming --ui-* variables, without a parallel Cairn light/dark palette. Minimal imports and third-party integration CSS remain legitimate.

Alternative: reproduce the current palette through global CSS overrides. Rejected because the agreed outcome adopts library defaults and reduces custom theme maintenance.

### Use built-in color mode across both routes

Use UColorModeButton on login and toolbar, and useColorMode for resolved mode consumers such as the minimap. Remove the custom boolean cookie owner and manual html/app--dark class management. Follow system mode until an explicit choice exists.

Perform migration once on the client before normal preference interaction: inspect whether the configured Nuxt color-mode persistence key already exists; if absent, migrate a valid legacy cookie value. Preserve an existing new preference, including system. Retire the legacy cookie after successful resolution; invalid values use system mode. Distinguish absent cookie from explicit false so previous light choices survive. Use the installed color-mode API and storage configuration as authoritative, and avoid accessing browser storage during SSR. Failed storage access must not prevent rendering.

Alternative: discard legacy preferences. Rejected to preserve user choices.

### Preserve graph geometry while adopting theme colors

Keep node dimensions, endpoint row geometry, handle offsets, square paths, gradients, selection clearing, and runtime stroke widths. Replace palette sources rather than layout. Use primary for selection/observed calls, warning for messages, error for failures, and success for healthy states. Framework badges can use theme-aware palette utilities where semantic status colors would confuse meaning. Register extra semantic roles in ui.theme.colors and map them in app.config.ts only when a distinct role is needed; no activate role is required.

Alternative: apply generic default spacing to graph geometry. Rejected because it risks handle misalignment and expands the scope.

### Separate technical completion from visual acceptance

Verify preference migration, route consistency, panel behavior, and graph state preservation with focused tests and required checks. Provide a runnable app for the user's look-and-feel review. Do not claim visual approval or require screenshot parity with the previous design.

## Risks / Trade-offs

- Removing overrides can expose spacing and overflow issues -> check drawer scrolling and form actions while retaining default spacing.
- Root mode changes affect login, overlays, and graph tokens -> consume the same resolved mode and verify each consumer.
- Repeated local overrides can defeat global defaults -> audit affected templates and remove redundant overrides alongside token migration.
- Theme colors can blur domain states -> retain line patterns and explicit state cues, and verify execution and selection separately.

## Migration Plan

Migrate shared color mode and preference handling, then shared controls and pages, then feature panels and graph/editor token consumers. Remove obsolete palette definitions and update architecture/agent guidance after consumers move. No persisted graph or database migration is needed. Rollback restores the previous frontend; migrated preferences may require the user to choose mode again, since the legacy cookie is retired.

## References

- https://ui.nuxt.com/docs/getting-started/theme/design-system
- https://ui.nuxt.com/docs/getting-started/theme/components
- https://ui.nuxt.com/docs/components/theme
- https://ui.nuxt.com/docs/components/color-mode-button
- Context7 documentation consulted for /nuxt/ui/v4.12.0.
