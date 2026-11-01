# Tasks

## 1. Migrate settings overlays to Nuxt UI

- [x] 1.1 Replace the native dialog shell in `ServiceSettingsPanel.vue` with `USlideover`; preserve right-side placement, controlled open state, Escape-to-discard, outside-click behavior, and Save/Discard actions, and verify the focused ServiceSettingsPanel tests pass.
- [x] 1.2 Replace the native dialog shell in `MockApiSettingsPanel.vue` with `USlideover`; preserve right-side placement, controlled open state, Escape-to-discard, outside-click behavior, and Save/Discard actions, and verify the focused MockApiSettingsPanel tests pass.
- [x] 1.3 Update Nuxt UI test stubs and overlay behavior coverage for both panels, and verify the ServiceSettingsPanel and MockApiSettingsPanel test files pass together.

## 2. Migrate shared settings-card and panel styles

- [x] 2.1 Move `SettingsAccordionCard.vue` layout, spacing, and typography to inline Tailwind utilities; retain only necessary state/integration hooks and verify its focused component tests pass.
- [x] 2.2 Move Service settings and Mock API settings visual utilities onto their template elements, including forms, section headers, cards, and actions; remove obsolete selector declarations and verify both focused panel test files pass.

## 3. Migrate remaining app-owned component styles

- [x] 3.1 Move visual styling in `AppToolbar.vue`, `AppToastStack.vue`, `ContextMenu.vue`, and `LatestRunDrawer.vue` to inline Tailwind utilities; retain required theme or selector hooks and verify each component's focused tests pass.
- [x] 3.2 Move `LogsPanel.vue` visual styling to inline utilities while keeping its custom resizable panel interaction; verify LogsPanel tests cover resizing, filters, and emitted actions.
- [x] 3.3 Move `ServiceGraphNode.vue` and `MockApiGraphNode.vue` element styling to inline utilities where practical; retain Vue Flow handles, `nodrag`, state hooks, and third-party integration rules, and verify both graph-node test files pass.
- [x] 3.4 Move app-shell visual properties from `app/app.vue` into the app template where appropriate; retain shared theme tokens, global resets, responsive/custom selectors, and Vue Flow/CodeMirror overrides, and verify `app/app.vue` has no remaining `@apply` rules for migrated UI.

## 4. Validate the styling boundary

- [x] 4.1 Search all app components for remaining app-owned BEM selectors and document why each remaining selector needs a semantic/state hook, custom selector, pseudo-element, or integration; verify there are no obsolete styling-only selectors.
- [x] 4.2 Run the repository Vite+ checks and unit tests, and review the migrated panels and graph in light/dark and narrow/desktop layouts; verify no behavior or visual regressions remain.
