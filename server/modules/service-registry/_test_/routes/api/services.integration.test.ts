import { eq } from "drizzle-orm";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createError } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { closeDb, getDb } from "../../../../../db";
import {
  environmentVariables,
  graphNodePositions,
  headerTemplates,
  projects,
  serviceEndpoints,
  services as servicesTable,
} from "../../../../../db/schema";

const integrationEnabled = process.env.CAIRN_RUN_INTEGRATION;
const integration = describe.skipIf(!integrationEnabled);

integration("service REST controllers with embedded stores", () => {
  const projectId = "service-route-integration-project";
  const fetchStub = vi.fn().mockResolvedValue({ ok: true });
  let listRoute: (event: never) => Promise<unknown>;
  let createRoute: (event: never) => Promise<unknown>;
  let updateRoute: (event: never) => Promise<unknown>;
  let deleteRoute: (event: never) => Promise<unknown>;
  let healthRoute: (event: never) => Promise<unknown>;
  let storageDirectory: string;
  let protoStorage: typeof import("../../../../../utils/proto-storage");

  beforeAll(async () => {
    process.env.PROJECT_ID = projectId;
    process.env.OTEL_COLLECTOR_URL = "http://localhost:4318";
    storageDirectory = await mkdtemp(join(tmpdir(), "cairn-service-protos-"));
    process.env.PROTO_STORAGE_DRIVER = "fs";
    process.env.PROTO_STORAGE_FS_BASE = storageDirectory;
    const runtime = globalThis as unknown as {
      defineEventHandler: <T>(handler: T) => T;
      readBody: (event: { context: { body?: unknown } }) => Promise<unknown>;
      getRouterParam: (
        event: { context: { params?: Record<string, string> } },
        name: string,
      ) => string | undefined;
      createError: typeof createError;
    };
    runtime.defineEventHandler = (handler) => handler;
    runtime.readBody = async (event) => event.context.body;
    runtime.getRouterParam = (event, name) => event.context.params?.[name];
    runtime.createError = createError;
    globalThis.fetch = fetchStub as typeof fetch;
    listRoute = (await import("../../../../../api/services/index.get")).default as typeof listRoute;
    createRoute = (await import("../../../../../api/services/index.post"))
      .default as typeof createRoute;
    updateRoute = (await import("../../../../../api/services/[id].put"))
      .default as typeof updateRoute;
    deleteRoute = (await import("../../../../../api/services/[id].delete"))
      .default as typeof deleteRoute;
    healthRoute = (await import("../../../../../api/services/health.get"))
      .default as typeof healthRoute;
    protoStorage = await import("../../../../../utils/proto-storage");
  });

  beforeEach(async () => {
    fetchStub.mockClear();
    await getDb().delete(projects).where(eq(projects.id, projectId));
  });

  afterAll(async () => {
    await getDb().delete(projects).where(eq(projects.id, projectId));
    await rm(storageDirectory, { recursive: true, force: true });
    await closeDb();
  });

  it("lists an empty service collection", async () => {
    await expect(listRoute({} as never)).resolves.toEqual([]);
  });

  it("creates and updates a service with its endpoints", async () => {
    const created = (await createRoute({
      context: {
        body: {
          name: "Orders",
          framework: "Spring Boot",
          baseUrl: "http://localhost:8081",
          positionX: 12,
          positionY: 13,
          endpoints: [
            {
              name: "List orders",
              method: "GET",
              url: "/orders",
            },
          ],
        },
      },
    } as never)) as { id: string };
    const initial = (await listRoute({} as never)) as Array<{
      id: string;
      endpoints: Array<{ id: string; name: string }>;
    }>;
    const endpointId = initial[0]?.endpoints[0]?.id;
    expect(created.id).toBeTruthy();
    expect(initial[0]).toMatchObject({ id: created.id });
    expect(initial[0]).not.toHaveProperty("positionX");
    await expect(
      getDb().select().from(graphNodePositions).where(eq(graphNodePositions.entityId, created.id)),
    ).resolves.toMatchObject([{ positionX: 12, positionY: 13 }]);
    expect(endpointId).toBeTruthy();

    await expect(
      updateRoute({
        context: {
          params: { id: created.id },
          body: {
            name: "Orders updated",
            framework: "Spring Boot",
            baseUrl: "http://localhost:8081",
            endpoints: [
              {
                id: endpointId,
                name: "List all orders",
                method: "GET",
                url: "/orders",
              },
            ],
          },
        },
      } as never),
    ).resolves.toEqual({ id: created.id });
    const updated = (await listRoute({} as never)) as Array<{
      name: string;
      endpoints: Array<{ name: string }>;
    }>;
    expect(updated[0]).toMatchObject({
      name: "Orders updated",
      endpoints: [{ name: "List all orders" }],
    });
  });

  it("persists WebSocket service types and preserves service and endpoint IDs through update and delete", async () => {
    const created = (await createRoute({
      context: {
        body: {
          name: "Notifications",
          apiType: "WEBSOCKET",
          framework: "Other",
          baseUrl: "wss://example.test/socket",
          endpoints: [{ name: "Events", url: "wss://example.test/events" }],
        },
      },
    } as never)) as { id: string };

    const initial = (await listRoute({} as never)) as Array<{
      id: string;
      apiType: string;
      endpoints: Array<{ id: string; url: string | null }>;
    }>;
    const initialService = initial.find(({ id }) => id === created.id)!;
    const endpointId = initialService.endpoints[0]!.id;
    expect(initialService).toMatchObject({
      apiType: "WEBSOCKET",
      endpoints: [{ url: "wss://example.test/events" }],
    });

    await updateRoute({
      context: {
        params: { id: created.id },
        body: {
          name: "Notifications updated",
          apiType: "WEBSOCKET",
          framework: "Other",
          baseUrl: "wss://example.test/socket",
          endpoints: [
            {
              id: endpointId,
              name: "Events updated",
              url: "wss://example.test/events",
            },
          ],
        },
      },
    } as never);

    const updated = (await listRoute({} as never)) as typeof initial;
    expect(updated.find(({ id }) => id === created.id)).toMatchObject({
      id: created.id,
      apiType: "WEBSOCKET",
      name: "Notifications updated",
      endpoints: [{ id: endpointId, name: "Events updated" }],
    });

    await expect(
      deleteRoute({ context: { params: { id: created.id } } } as never),
    ).resolves.toEqual({
      id: created.id,
    });
    await expect(
      getDb().select().from(serviceEndpoints).where(eq(serviceEndpoints.id, endpointId)),
    ).resolves.toEqual([]);
  });

  it("persists proto files across list reloads, replaces old versions, and removes files on delete", async () => {
    const firstProto = 'syntax = "proto3"; package demo; service Echo {}';
    const secondProto =
      'syntax = "proto3"; package demo; service Echo { rpc Get(Request) returns (Reply); }';
    const created = (await createRoute({
      context: {
        body: {
          name: "Echo",
          apiType: "GRPC",
          framework: "Other",
          baseUrl: "localhost:50051",
          grpcTls: true,
          protoContent: firstProto,
          endpoints: [{ name: "Get", rpcMethod: "/demo.Echo/Get" }],
        },
      },
    } as never)) as { id: string };
    const endpointId = (
      (await listRoute({} as never)) as Array<{ id: string; endpoints: Array<{ id: string }> }>
    )[0]!.endpoints[0]!.id;
    const [firstRow] = await getDb()
      .select({ protoStorageKey: servicesTable.protoStorageKey })
      .from(servicesTable)
      .where(eq(servicesTable.id, created.id));
    expect(firstRow?.protoStorageKey).toBeTruthy();
    expect(await protoStorage.getProtoFile(firstRow!.protoStorageKey!)).toBe(firstProto);

    await updateRoute({
      context: {
        params: { id: created.id },
        body: {
          name: "Echo",
          apiType: "GRPC",
          framework: "Other",
          baseUrl: "localhost:50051",
          grpcTls: true,
          protoContent: secondProto,
          endpoints: [{ id: endpointId, name: "Get", rpcMethod: "/demo.Echo/Get" }],
        },
      },
    } as never);
    const [secondRow] = await getDb()
      .select({ protoStorageKey: servicesTable.protoStorageKey })
      .from(servicesTable)
      .where(eq(servicesTable.id, created.id));
    expect(secondRow?.protoStorageKey).not.toBe(firstRow?.protoStorageKey);
    expect(await protoStorage.getProtoFile(secondRow!.protoStorageKey!)).toBe(secondProto);
    expect(await protoStorage.getProtoFile(firstRow!.protoStorageKey!)).toBeNull();
    await expect(
      deleteRoute({ context: { params: { id: created.id } } } as never),
    ).resolves.toEqual({
      id: created.id,
    });
    expect(await protoStorage.getProtoFile(secondRow!.protoStorageKey!)).toBeNull();
  });

  it("rejects endpoint ids owned by a different service", async () => {
    const created = (await createRoute({
      context: {
        body: {
          name: "Orders",
          framework: "Spring Boot",
          baseUrl: "http://localhost:8081",
          endpoints: [],
        },
      },
    } as never)) as { id: string };
    await expect(
      updateRoute({
        context: {
          params: { id: created.id },
          body: {
            name: "Orders",
            framework: "Spring Boot",
            baseUrl: "http://localhost:8081",
            endpoints: [
              {
                id: "belongs-elsewhere",
                name: "Foreign",
                method: "GET",
                url: "/",
              },
            ],
          },
        },
      } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("deletes services and returns 404 for missing ids", async () => {
    const created = (await createRoute({
      context: {
        body: {
          name: "Orders",
          framework: "Spring Boot",
          baseUrl: "http://localhost:8081",
          endpoints: [],
        },
      },
    } as never)) as { id: string };
    await expect(
      deleteRoute({ context: { params: { id: created.id } } } as never),
    ).resolves.toEqual({ id: created.id });
    await expect(
      deleteRoute({ context: { params: { id: created.id } } } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("checks health using the framework-specific endpoint", async () => {
    await createRoute({
      context: {
        body: {
          name: "Orders",
          framework: "Spring Boot",
          baseUrl: "http://localhost:8081",
          endpoints: [],
        },
      },
    } as never);
    const result = await healthRoute({} as never);
    expect(result).toEqual([{ id: expect.any(String), online: true }]);
    expect(String(fetchStub.mock.calls[0]?.[0])).toBe(
      "http://localhost:8081/actuator/health/readiness",
    );
    expect(fetchStub.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it("checks Other services with scoped templates and shared variables", async () => {
    await getDb().insert(projects).values({ id: projectId });
    await getDb()
      .insert(headerTemplates)
      .values({
        id: "service-health-template",
        projectId,
        name: "Health auth",
        headers: [{ name: "X-Health", value: "ready" }],
      });
    await getDb().insert(environmentVariables).values({
      id: "service-health-variable",
      projectId,
      name: "apiKey",
      value: "secret",
    });
    await createRoute({
      context: {
        body: {
          name: "Custom",
          framework: "Other",
          baseUrl: "http://localhost:8082",
          healthCheckUrl: "https://health.example/status",
          healthCheckHeaderTemplateId: "service-health-template",
          healthCheckCustomHeaders: [{ name: "X-API-Key", value: "{{apiKey}}" }],
          endpoints: [],
        },
      },
    } as never);
    const health = await healthRoute({} as never);
    expect(health).toHaveLength(1);
    const [url, options] = fetchStub.mock.calls[0]!;
    expect(String(url)).toBe("https://health.example/status");
    expect(options).toMatchObject({
      method: "GET",
      headers: { "X-Health": "ready", "X-API-Key": "secret" },
    });
  });
});
