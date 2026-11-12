# Design

## Context

See `proposal.md`. Nuxt UI 4 and Tailwind CSS v4 are installed. `app/app.vue` defines light and dark CSS variables and Tailwind aliases, while components also use direct variable references and local Nuxt UI overrides. `WorkspaceDrawer` and `SettingsAccordionCard` are existing shared controls. The workspace layout and graph-specific styling must remain stable.

## Goals / Non-Goals

**Goals:** Establish one theme vocabulary for shared colors and control styling; make later Feature-Sliced Design slices consume shared UI through explicit public APIs; separate migrated tests from production files.

**Non-Goals:** Rebuild graph nodes, change CRUD workflows, reorganize feature modules, add lazy loading, change database or API contracts, or redesign the palette.

## Decisions

### Use Nuxt UI semantic theme configuration for shared controls

Define shared semantic colors and component defaults in `app/app.config.ts`, with palette values and Tailwind theme aliases in `app/app.vue`. Map current light and dark values to those tokens. Use Nuxt UI `class` and `ui` props only for component-specific exceptions. Keep graph, protocol, telemetry, and Vue Flow selectors in CSS where semantic state or integration requires them. This makes a palette change central while leaving domain-specific colors explicit.

Alternative: replace all CSS with utilities. Rejected because runtime theme variables and third-party selectors need stable CSS hooks.

### Keep layout utilities local and standardize only repeated values

Preserve each drawer's position, width, and button placement. Establish shared spacing, size, and state defaults for equivalent Nuxt UI controls. Keep one-off layout utilities beside their elements. Do not create a new global spacing class for each existing utility string.

Alternative: move every utility into global CSS. Rejected because it would hide layout decisions and increase selector coupling.

### Move shared controls into the FSD Shared layer

Move the reusable drawer and card structure to `app/shared/ui`, with a deliberate `index.ts` public API for imports from other slices. Keep domain data, save/discard state, and graph behavior out of shared controls. Internal shared-UI imports remain direct to avoid barrel cycles. Future manage-node and mock-API features compose these controls from higher FSD layers.

Alternative: build a generic form framework. Rejected because the controls share presentation, while entity forms retain distinct behavior.

### Keep tests under module `_test_` directories

Place each migrated module's tests in one `_test_` directory, mirroring paths relative to that module. For example, `app/shared/ui/WorkspaceDrawer.vue` pairs with `app/shared/ui/_test_/WorkspaceDrawer.test.ts`. Move existing tests with their production modules. Add focused light/dark and interaction checks for shared controls; compare rendered layouts at desktop and narrow widths.

Alternative: leave tests beside production files. Rejected because the agreed module convention separates test navigation from production code.

## Risks / Trade-offs

- Theme aliases can collide with existing CSS variables: migrate one shared control at a time and remove old overrides only after checking all consumers.
- Nuxt UI defaults can shift sizing or focus behavior: verify light/dark, keyboard focus, and drawer dismissal for each migrated control.
- File moves can affect Nuxt component resolution: use explicit imports through the shared public API and run build validation.

## Migration Plan

1. Record current light/dark palette values and rendered shared-control appearance at desktop and narrow widths.
2. Introduce Nuxt UI theme configuration and map existing shared tokens without changing geometry.
3. Move shared drawer and card controls plus their tests into `app/shared/ui` and `_test_`; update imports through its public API.
4. Remove superseded global control rules while retaining graph and integration selectors.
5. Run focused tests, `vp check`, `vp build`, and strict OpenSpec validation; compare both themes and widths. Revert an individual control migration if appearance or behavior changes unexpectedly.
