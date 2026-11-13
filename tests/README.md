# Tests

Vitest is provided by Vite+. Run unit and component tests with:

```sh
vp run test:unit
```

Run repository and route integration tests with disposable SQLite and DuckDB files:

```sh
vp run test:integration
```

The integration script sets `CAIRN_RUN_INTEGRATION=1` and runs every `*.integration.test.ts` file. Each worker creates temporary files, applies the same startup migrations as the app, and removes its files after testing. No database service or connection URL is needed.

Use `vp test` for the default test discovery and `vp check` for formatting, lint, and types. The SonarCloud workflow enables integration tests with `CAIRN_RUN_INTEGRATION=1` while collecting coverage.
