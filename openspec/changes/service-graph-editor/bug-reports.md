# Bug reports

## BUG-001: Browser and custom context menus opened together

- **Status:** Fixed
- **Symptom:** The first right-click on the canvas displayed the custom Add node menu and the browser's native context menu at the same time.
- **Cause:** The Vue Flow pane context-menu handler opened the custom menu without preventing the first native `contextmenu` event.
- **Fix:** Handle canvas context events at one owner. Prevent the first native menu; when the custom menu is already open, close it and leave the next event unhandled so the browser menu opens.
- **Code:** `app/app.vue` — `handleCanvasContextMenu`.
- **Verification:** Production build and scoped lint/type checks pass. Interactive browser verification remains pending.

## BUG-002: Vue Flow utility controls rendered without visible icons

- **Status:** Fixed
- **Symptom:** The canvas zoom and fit controls appeared without their icons.
- **Cause:** The Vue Flow Controls package stylesheet was not loaded, so its SVG sizing and button styles were missing.
- **Fix:** Import `@vue-flow/controls/dist/style.css` alongside the Vue Flow core styles.
- **Code:** `app/app.vue` — Vue Flow style imports.
- **Verification:** Production build and scoped lint/type checks pass. Interactive browser verification remains pending.

## BUG-003: Graph connection handles drifted away from their rows

- **Status:** Fixed
- **Symptom:** Endpoint and mock API connection points moved progressively away from their corresponding rows.
- **Cause:** Handle coordinates were set as absolute offsets even though each handle is positioned relative to its own row.
- **Fix:** Remove the hard-coded offsets and use Vue Flow's centered handle placement within each row.
- **Code:** `app/app.vue` — endpoint and mock API row handles.
- **Verification:** Production build and scoped lint/type checks pass. Interactive browser verification remains pending.
