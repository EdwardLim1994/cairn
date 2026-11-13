# Frontend slices

The frontend follows `pages → widgets → features → entities → shared`. A higher layer imports a lower layer through that slice's `index.ts`; files inside one slice may import siblings directly. Peer slices communicate through props, events, or the page coordinator. Avoid imports from a lower layer back into a higher layer.

`app/shared/ui` owns reusable drawer and card controls. `app/shared/api` owns the validated HTTP client. `app/entities` will own the canonical service, message destination, and mock API data. `app/features` will own editor and execution actions. `app/widgets` will compose graph and panel views. The workspace page coordinates bootstrap and cross-widget intents.

Place tests in each migrated module's `_test_` directory. Keep the toolbar, graph canvas, and node types on the initial loading path; defer closed panels and their data work.
