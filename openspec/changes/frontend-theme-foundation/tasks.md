# Tasks

## 1. Theme baseline and tokens

- [ ] 1.1 Record current light/dark shared-control appearance at desktop and narrow widths; verify baseline captures drawer placement, button placement, colors, and focus states.
- [ ] 1.2 Map current shared palette to Nuxt UI semantic colors and Tailwind tokens in `app/app.config.ts` and `app/app.vue`; verify both themes against baseline and run `vp check` on changed files.
- [ ] 1.3 Standardize shared Nuxt UI control defaults for size, spacing, color, and interactive states; add focused theme checks under the owning module's `_test_` directory and verify them with `vp test run`.

## 2. Shared drawer and card controls

- [ ] 2.1 Move `WorkspaceDrawer` into `app/shared/ui` with explicit public exports; move its tests into `app/shared/ui/_test_` and verify drawer dismissal and placement with focused tests.
- [ ] 2.2 Move shared `SettingsAccordionCard` structure into `app/shared/ui`; move its tests into `app/shared/ui/_test_` and verify navigation, expansion, and action intents with focused tests.
- [ ] 2.3 Update shared-control consumers to import through the public API and remove superseded global control rules; verify existing panel tests, light/dark appearance, and desktop/narrow layout.

## 3. Integration checks

- [ ] 3.1 Run `vp check`, focused `vp test run`, `vp run build`, and `openspec validate frontend-theme-foundation --strict`; verify all pass and no panel or graph interaction regressed.
