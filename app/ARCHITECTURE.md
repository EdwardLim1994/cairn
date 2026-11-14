# Frontend slices

The frontend follows `pages → widgets → features → entities → shared`. A higher layer imports a lower layer through that slice's `index.ts`; files inside one slice may import siblings directly. Peer slices communicate through props, events, or the page coordinator. Avoid imports from a lower layer back into a higher layer.

`app/shared/ui` owns reusable drawer and card controls. `app/shared/api` owns the validated HTTP client. `app/entities` will own the canonical service, message destination, and mock API data. `app/features` will own editor and execution actions. `app/widgets` will compose graph and panel views. The workspace page coordinates bootstrap and cross-widget intents.

Place tests in each migrated module's `__test__` directory. Keep the toolbar, graph canvas, and node types on the initial loading path; defer closed panels and their data work.

## Theme ownership

Nuxt UI owns generic control appearance and spacing. `app.config.ts` assigns semantic palettes; local `ui` overrides are reserved for necessary layout or domain behavior. Use semantic utilities such as `bg-default`, `text-muted`, and `border-default`. Register extra semantic colors through `nuxt.config.ts` only when a distinct role needs independent configuration.

Login and workspace share `useColorMode()` and built-in `UColorModeButton` controls. The default preference is system. The client migration copies a valid legacy `cairn-dark-mode` cookie only when no new saved preference exists, then retires that cookie. Storage failures do not block rendering.

`app.vue` keeps Nuxt UI/Tailwind imports and necessary graph/editor integration CSS consuming `--ui-*` tokens. Graph cards and handle offsets preserve their dimensions; control and panel spacing adopts Nuxt UI defaults. Do not restore a duplicate palette or manual dark-mode classes.
