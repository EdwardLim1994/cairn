# Proposal

## Why

The app mixes Tailwind utilities in templates with a large global BEM stylesheet that uses `@apply`, making visual changes harder to localize and increasing the chance of unintended layout changes. Migrating suitable generic UI to Nuxt UI first, then moving visual utilities beside their elements, will make the styling easier to maintain without changing product behavior.

## What Changes

- Replace suitable hand-built generic controls with Nuxt UI components, prioritizing the Service and Mock API side panels while preserving their existing state, dismissal, and Save/Discard behavior.
- Migrate app-owned layout, spacing, typography, sizing, border, and state styling from BEM CSS rules to inline Tailwind utilities in stages.
- Retain BEM classes only as needed for semantic or state hooks, custom selectors, pseudo-elements, and third-party integrations. Keep global theme tokens, resets, Vue Flow styling, and CodeMirror styling where utilities are not a good fit.
- Keep domain-specific graph interactions, CodeMirror, and the resizable logs control as Cairn-owned UI.

## Capabilities

### New Capabilities

None. This change restructures existing UI implementation without introducing user-visible behavior.

### Modified Capabilities

None. Existing interaction and dismissal behavior remains unchanged.

## Impact

Affected areas include `app/components/ServiceSettingsPanel.vue`, `app/components/MockApiSettingsPanel.vue`, shared panel/card components, `app/app.vue` styles, and component tests that stub Nuxt UI. No new dependency or API change is expected. `AGENTS.md` has been updated to guide future work toward Tailwind utilities and appropriate Nuxt UI components.
