# Tests

Vitest is provided by the Vite+ toolchain. Use the package scripts to run the unit/component suite or the MySQL-backed integration suite separately.

```sh
bun run test:unit
```

Integration tests require a disposable MySQL database. Start it and run the suite with:

```sh
docker compose -p cairn-personal-test -f docker-compose.test.yml up -d --wait mysql-test
CAIRN_TEST_DATABASE_URL=mysql://cairn_test:cairn_test_only@127.0.0.1:13306/cairn_test bun run test:integration
```

PowerShell:

```powershell
docker compose -p cairn-personal-test -f docker-compose.test.yml up -d --wait mysql-test
$env:CAIRN_TEST_DATABASE_URL = "mysql://cairn_test:cairn_test_only@127.0.0.1:13306/cairn_test"
bun run test:integration
Remove-Item Env:CAIRN_TEST_DATABASE_URL
```

The integration script applies Drizzle migrations before running `*.integration.test.ts` tests and fails early when `CAIRN_TEST_DATABASE_URL` is missing. The test MySQL service uses a temporary filesystem and a separate Compose project, so it does not touch the app's configured database.

Run both suites with `bun run test:unit` followed by `bun run test:integration`. `bun run test` runs all discovered tests and is useful in CI when its MySQL service and test database environment variables are configured.
