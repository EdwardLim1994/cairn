# Tasks

## 1. Endpoint relationship data

- [ ] 1.1 Add nullable source endpoint identity to saved service calls and create the migration; verify existing rows remain present with no guessed source endpoint after migration.
- [ ] 1.2 Update canvas contracts and save validation for endpoint-to-endpoint calls, including project ownership and source-service ownership; verify valid pairs save and invalid endpoint combinations fail.
- [ ] 1.3 Update canvas load/save repositories to round-trip assigned and legacy unassigned calls; verify both forms persist across reload.

## 2. Graph interactions

- [ ] 2.1 Add inbound and outbound endpoint handles and shared collapsed positions; verify collapsed wires retain endpoint-specific handle identities and wire gestures require expanded rows.
- [ ] 2.2 Render endpoint-to-endpoint calls and legacy unassigned calls, and support creating, reconnecting, and deleting wires; verify each graph interaction updates the saved relationship identity.
- [ ] 2.3 Add endpoint-card outbound call lists, target endpoint selection, and confirmed removal; verify panel changes update the same graph edges and cancellation preserves the call.
- [ ] 2.4 Keep OpenAPI import limited to endpoint definitions; verify importing operations creates no service call relationships.

## 3. Integration verification

- [ ] 3.1 Verify a legacy call remains service-level until its wire is reassigned, then saves and reloads with the chosen source endpoint.
- [ ] 3.2 Verify adding, editing, deleting, collapsing, and expanding endpoint calls keeps panel rows and graph wires synchronized.
