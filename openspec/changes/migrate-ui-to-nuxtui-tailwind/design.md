# Design

## Context

See `proposal.md` for motivation and scope. Cairn uses Nuxt UI 4, Tailwind CSS v4, Vue 3, and Vue Flow. Most form controls, accordions, dropdowns, buttons, alerts, and context menus already use Nuxt UI. The Service and Mock API settings panels still implement right-side dialogs with native `<dialog>` elements and global BEM rules. `app/app.vue` holds the global theme variables, resets, custom component rules, third-party overrides, and many `@apply` declarations. The repository has no existing OpenSpec capability specs; this is a behavior-preserving UI refactor.

## Goals / Non-Goals

**Goals:**

- Replace generic hand-built overlay primitives with installed Nuxt UI components where their behavior fits.
- Make component-specific visual utilities visible beside the elements they affect.
- Preserve the current appearance, responsive behavior, theme behavior, and user interactions through each migration slice.
- Leave a smaller, clearly bounded global stylesheet for shared tokens, resets, selectors that need CSS, and third-party integration rules.

**Non-Goals:**

- Redesigning Cairn's visual language or changing user-visible interactions.
- Replacing Vue Flow, CodeMirror, or the custom resizable Logs panel with generic controls.
- Removing all BEM identifiers when they remain useful as semantic/state hooks or are required by custom and third-party selectors.
- Adding or changing dependencies.

## Decisions

### Migrate UI primitives before moving their visual styles

First migrate the Service and Mock API side panels from duplicated native dialog/backdrop markup to Nuxt UI `USlideover`, which supports a right-side panel in the installed version. Bind each overlay to its existing panel state and retain its current width and theme. Preserve explicit Save/Discard actions, Escape behavior, and the current behavior where clicking outside does not dismiss the panel. Keep existing generic Nuxt UI controls and wrappers that connect them to Cairn state. Do not replace graph actions, the CodeMirror editor, file inputs, or the resize slider merely to use a UI-kit component.

Alternative considered: migrate each control while converting its styles. Rejected because it combines interaction changes with visual changes, making regressions harder to isolate.

### Move visual properties to Tailwind utilities in small component slices

Convert one component or cohesive surface at a time, starting with the recently touched settings panels and shared accordion card. Put layout, spacing, typography, sizing, borders, and ordinary states on the corresponding template elements. Remove the old BEM declarations once their visual properties have moved so utilities and CSS do not compete. Use static utility strings in Vue `:class` bindings for state variants.

Alternative considered: replace the global stylesheet in one pass. Rejected because the stylesheet serves many independent surfaces and includes custom state, responsive, and graph selectors; a single rewrite would make appearance regressions difficult to localize.

### Keep CSS for global and selector-driven behavior

Retain font imports, global resets, runtime light/dark theme variables, Vue Flow and CodeMirror overrides, pseudo-elements, and custom rules that cannot be expressed clearly with utilities. Keep BEM classes only when they are needed as semantic/state hooks, for custom selector composition, or to target third-party markup. Avoid keeping BEM classes solely to attach ordinary visual properties.

Alternative considered: remove every BEM class and put every declaration in utilities. Rejected because some selectors express runtime themes, pseudo-elements, and third-party integration points, where CSS remains clearer and more reliable.

### Validate each slice before continuing

Use focused component tests for behavior and compare the rendered light/dark and narrow/desktop layouts as each surface changes. Run the repository's Vite+ checks and relevant component tests for implementation changes. Update component test stubs when adopting Nuxt UI overlays so tests continue to verify emitted intents and state changes without mounting Nuxt.

## Risks / Trade-offs

- **Nuxt UI overlay defaults could change dismissal or focus behavior** → Configure and test controlled open state, Escape handling, outside-click behavior, focus management, and Save/Discard outcomes before removing the native implementation.
- **Inline utilities can become long or duplicated** → Convert by cohesive component, keep true shared tokens in CSS, and retain BEM hooks only for state or selector integration.
- **Removing an old selector can affect multiple components** → Search every usage before deleting a rule and migrate each consumer together.
- **Theme variables and third-party overrides do not map cleanly to utilities** → Keep them in the global stylesheet and document them as intentional CSS boundaries.

## Migration Plan

1. Capture the existing appearance and interaction behavior of the affected panels and identify CSS selectors shared with other surfaces.
2. Migrate the Service and Mock API panels to `USlideover`; update focused test stubs and verify dismissal and save/discard behavior.
3. Move inline-friendly Tailwind styling for shared settings cards and the two panels into template classes, deleting only declarations whose consumers have migrated.
4. Continue through the remaining app-owned components in cohesive slices; retain custom graph, editor, resize, theme, and integration rules where needed.
5. Run focused tests and Vite+ checks, and review light/dark and responsive layouts. Revert a slice independently if its behavior or appearance regresses.

## Remaining BEM Hook Audit

The remaining app-owned BEM classes have these purposes; ordinary layout, spacing, typography, and control styling has moved to template utilities.

| Selector family                                                                                                                                              | Why it remains                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.app`, `.app--dark`, `.app__surface`                                                                                                                        | Scope runtime theme tokens and apply the shared themed surface to panels and graph nodes.                                                                                                                 |
| `.app__framework-select`, `.app__framework-select-menu`                                                                                                      | Runtime hooks used by `useSettingsPanelViewModel` to keep the framework picker open for clicks inside its trigger or portaled menu.                                                                       |
| `.app__graph-flow`, `.app__flow-node*`, `.app__flow-edge*`, `.app__graph-node*`                                                                              | Vue Flow integration hooks identify the canvas, node types, selected/observed/error states, and graph edge states. They also provide fixed graph-node sizing and connect to Vue Flow's own DOM selectors. |
| `.app__endpoint-row`, `.app__endpoint-row--collapsed`, `.app__endpoint-row--bundle`, `.app__mock-row`, `.app__mock-row--collapsed`, `.app__mock-row--bundle` | State hooks implement collapsed connection bundling; CSS must position the retained Vue Flow handle and hide other row children.                                                                          |
| `.app__endpoint-handle`, `.app__mock-handle`, `.app__service-source`                                                                                         | Target Vue Flow handle elements for size, border, edge color, and side-specific positioning.                                                                                                              |
| `.app__method-tag--*`, `.app__severity--*`, `.app__run-state--*`, `.app__status-text`, `.app__status-text--error`                                            | Semantic state hooks map HTTP methods, log severities, run outcomes, and errors to shared theme colors.                                                                                                   |
| `.app__run-spinner`                                                                                                                                          | Applies the loading animation to the in-progress run icon.                                                                                                                                                |
| `.app__logs-resize-control`, `.app__logs-resize-grip`, `.app__logs-resize-handle`                                                                            | Custom pointer/keyboard resize control hooks; `:focus-within` exposes its focus ring and CSS keeps the native range input as an invisible hit target.                                                     |

The obsolete `.app__button`, `.app__control`, panel layout, toast, context-menu, app-shell, and graph-node presentation selectors were removed after their consumers moved to Tailwind utilities. Unused `.app__settings-accordion-chevron` and `.app__code-input` rules were removed as well.

## Open Questions

None. The component scan identified the two side panels as the main Nuxt UI overlay candidates; existing generic controls are already on Nuxt UI.
