import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import type { GraphCodeManifest } from "#shared/api/graph-code";
import { applyGraphCode } from "./graph-code";
import { getCanvas } from "./canvas";
import * as schema from "../db/schema";
import {
  graphNodePositions,
  environmentVariables,
  messageConnections,
  messageDestinations,
  mockApis,
  projects,
  serviceEdges,
  serviceEndpoints,
  services,
} from "../db/schema";

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("graph code repository with MySQL", () => {
  const projectId = "graph-code-integration-project";
  let pool: mysql.Pool | undefined;
  let db: MySql2Database<typeof schema> | undefined;

  beforeAll(async () => {
    pool = mysql.createPool(connectionString!);
    db = drizzle({ client: pool, schema, mode: "default" });
    await pool.query("SELECT 1");
  });

  beforeEach(async () => {
    await db!.delete(projects).where(eq(projects.id, projectId));
    await db!.insert(projects).values({ id: projectId });
  });

  afterAll(async () => {
    await db?.delete(projects).where(eq(projects.id, projectId));
    await pool?.end();
  });

  it("reconciles by keys, keeps trigger records, and preserves matching positions", async () => {
    await db!.insert(services).values([
      {
        id: "graph-code-orders",
        projectId,
        codeKey: "orders",
        name: "Orders",
        framework: "Spring Boot",
        baseUrl: "http://orders",
      },
      {
        id: "graph-code-payments",
        projectId,
        codeKey: "payments",
        name: "Payments",
        framework: ".NET",
        baseUrl: "http://payments",
      },
    ]);
    await db!.insert(serviceEndpoints).values([
      {
        id: "graph-code-orders-endpoint",
        projectId,
        serviceId: "graph-code-orders",
        codeKey: "create-order",
        name: "Create order",
        method: "POST",
        url: "/orders",
      },
      {
        id: "graph-code-payments-endpoint",
        projectId,
        serviceId: "graph-code-payments",
        codeKey: "capture",
        name: "Capture",
        method: "POST",
        url: "/capture",
      },
    ]);
    await db!.insert(mockApis).values({
      id: "graph-code-trigger",
      projectId,
      name: "Existing trigger",
      targetEndpointId: "graph-code-payments-endpoint",
      active: true,
      requestJson: {},
    });
    await db!.insert(graphNodePositions).values([
      {
        id: "graph-code-position-orders",
        projectId,
        nodeType: "service",
        entityId: "graph-code-orders",
        positionX: 40,
        positionY: 50,
      },
      {
        id: "graph-code-position-payments",
        projectId,
        nodeType: "service",
        entityId: "graph-code-payments",
        positionX: 760,
        positionY: 20,
      },
      {
        id: "graph-code-position-trigger",
        projectId,
        nodeType: "mock_api",
        entityId: "graph-code-trigger",
        positionX: 500,
        positionY: 60,
      },
    ]);

    const manifest: GraphCodeManifest = {
      version: 1,
      services: [
        {
          key: "orders",
          name: "Orders renamed",
          apiType: "REST",
          framework: "Spring Boot",
          baseUrl: "http://orders-v2",
          healthCheck: { url: "/ready", headers: [{ name: "X-Key", value: "value" }] },
          endpoints: [
            {
              key: "create-order",
              name: "Create order",
              method: "POST",
              url: "/orders",
              outboundConnections: [{ serviceKey: "billing", endpointKey: "charge" }],
            },
          ],
        },
        {
          key: "billing",
          name: "Billing",
          apiType: "REST",
          framework: "Other",
          baseUrl: "http://billing",
          endpoints: [
            {
              key: "charge",
              name: "Charge",
              method: "POST",
              url: "/charges",
              outboundConnections: [],
            },
          ],
        },
      ],
    };
    await applyGraphCode(projectId, manifest, db!);

    const serviceRows = await db!.select().from(services).where(eq(services.projectId, projectId));
    const endpointRows = await db!
      .select()
      .from(serviceEndpoints)
      .where(eq(serviceEndpoints.projectId, projectId));
    const edgeRows = await db!
      .select()
      .from(serviceEdges)
      .where(eq(serviceEdges.projectId, projectId));
    const apiRows = await db!.select().from(mockApis).where(eq(mockApis.projectId, projectId));
    const positions = await db!
      .select()
      .from(graphNodePositions)
      .where(eq(graphNodePositions.projectId, projectId));
    expect(serviceRows.map(({ codeKey }) => codeKey)).toEqual(
      expect.arrayContaining(["billing", "orders"]),
    );
    expect(serviceRows).toHaveLength(2);
    expect(serviceRows.find(({ codeKey }) => codeKey === "orders")?.id).toBe("graph-code-orders");
    expect(endpointRows.find(({ codeKey }) => codeKey === "create-order")?.id).toBe(
      "graph-code-orders-endpoint",
    );
    expect(serviceRows.find(({ codeKey }) => codeKey === "orders")).toMatchObject({
      healthCheckUrl: "/ready",
      healthCheckHeaderTemplateId: null,
      healthCheckCustomHeaders: [{ name: "X-Key", value: "value" }],
    });
    expect(endpointRows.some(({ codeKey }) => codeKey === "capture")).toBe(false);
    expect(edgeRows).toHaveLength(1);
    expect(apiRows).toHaveLength(1);
    expect(apiRows[0]).toMatchObject({
      id: "graph-code-trigger",
      targetEndpointId: null,
      active: false,
    });
    expect(positions.find(({ entityId }) => entityId === "graph-code-orders")).toMatchObject({
      positionX: 40,
      positionY: 50,
    });
    expect(positions.find(({ entityId }) => entityId === "graph-code-trigger")).toMatchObject({
      positionX: 500,
      positionY: 60,
    });
    const billing = serviceRows.find(({ codeKey }) => codeKey === "billing")!;
    expect(positions.find(({ entityId }) => entityId === billing.id)?.positionX).toBeGreaterThan(
      760,
    );
  });

  it("lays out a blank canvas in outbound-call direction", async () => {
    const manifest: GraphCodeManifest = {
      version: 1,
      services: [
        {
          key: "caller",
          name: "Caller",
          apiType: "REST",
          framework: "Other",
          baseUrl: "http://caller",
          endpoints: [
            {
              key: "call",
              name: "Call",
              method: "GET",
              url: "/call",
              outboundConnections: [{ serviceKey: "target", endpointKey: "read" }],
            },
          ],
        },
        {
          key: "target",
          name: "Target",
          apiType: "REST",
          framework: "Other",
          baseUrl: "http://target",
          endpoints: [
            {
              key: "read",
              name: "Read",
              method: "GET",
              url: "/read",
              outboundConnections: [],
            },
          ],
        },
      ],
    };
    await applyGraphCode(projectId, manifest, db!);
    const rows = await db!
      .select({ service: services.codeKey, positionX: graphNodePositions.positionX })
      .from(services)
      .innerJoin(graphNodePositions, eq(services.id, graphNodePositions.entityId))
      .where(eq(services.projectId, projectId));
    const x = new Map(rows.map(({ service, positionX }) => [service, positionX]));
    expect(x.get("caller")).toBeLessThan(x.get("target")!);
    const canvas = await getCanvas(projectId, db!);
    expect(canvas.services.find(({ codeKey }) => codeKey === "caller")?.positionX).toBe(
      x.get("caller"),
    );
    expect(canvas.services.find(({ codeKey }) => codeKey === "target")?.positionX).toBe(
      x.get("target"),
    );
  });

  it("applies version 2 message topology, uses secret references, and preserves destination positions", async () => {
    await db!.insert(environmentVariables).values({
      id: "graph-code-kafka-password",
      projectId,
      name: "KAFKA_PASSWORD",
      value: "private-value",
    });
    const manifest: GraphCodeManifest = {
      version: 2,
      services: [
        {
          key: "producer",
          name: "Producer",
          framework: "Other",
          baseUrl: "http://producer",
          endpoints: [
            {
              key: "publish",
              name: "Publish",
              method: "POST",
              url: "/publish",
              outboundConnections: [],
            },
          ],
        },
        {
          key: "consumer",
          name: "Consumer",
          framework: "Other",
          baseUrl: "http://consumer",
          endpoints: [],
        },
      ],
      destinations: [
        {
          key: "orders-topic",
          broker: "kafka",
          name: "Orders",
          connection: {
            brokers: "localhost:9092",
            securityProtocol: "SASL_SSL",
            saslMechanism: "plain",
            username: "operator",
            passwordVariable: "KAFKA_PASSWORD",
          },
        },
      ],
      messageConnections: [
        {
          type: "publish",
          destinationKey: "orders-topic",
          serviceKey: "producer",
          endpointKey: "publish",
        },
        {
          type: "subscribe",
          destinationKey: "orders-topic",
          serviceKey: "consumer",
          consumerGroup: "orders-v1",
        },
      ],
    };
    await applyGraphCode(projectId, manifest, db!);
    const [destination] = await db!
      .select()
      .from(messageDestinations)
      .where(eq(messageDestinations.projectId, projectId));
    const originalPosition = await db!
      .select()
      .from(graphNodePositions)
      .where(eq(graphNodePositions.entityId, destination!.queueId));
    await db!
      .update(graphNodePositions)
      .set({ positionX: 444, positionY: 222 })
      .where(eq(graphNodePositions.entityId, destination!.queueId));

    await applyGraphCode(
      projectId,
      {
        ...manifest,
        destinations: manifest.destinations!.map((item) => ({ ...item, name: "Orders v2" })),
      },
      db!,
    );

    const nextDestinations = await db!
      .select()
      .from(messageDestinations)
      .where(eq(messageDestinations.projectId, projectId));
    expect(nextDestinations).toHaveLength(1);
    expect(nextDestinations[0]).toMatchObject({
      id: destination!.id,
      codeKey: "orders-topic",
      name: "Orders v2",
    });
    expect(nextDestinations[0]?.connection).not.toHaveProperty("password");
    expect(
      await db!
        .select()
        .from(messageConnections)
        .where(eq(messageConnections.projectId, projectId)),
    ).toHaveLength(2);
    const preserved = await db!
      .select()
      .from(graphNodePositions)
      .where(eq(graphNodePositions.entityId, destination!.queueId));
    expect(preserved[0]).toMatchObject({ positionX: 444, positionY: 222 });
    expect(originalPosition[0]).toBeDefined();

    await applyGraphCode(
      projectId,
      { version: 1, services: manifest.services } as GraphCodeManifest,
      db!,
    );
    expect(
      await db!
        .select()
        .from(messageDestinations)
        .where(eq(messageDestinations.projectId, projectId)),
    ).toEqual([]);
  });

  it("rolls back the whole import when persistence fails", async () => {
    await db!.insert(services).values({
      id: "graph-code-existing",
      projectId,
      codeKey: "existing",
      name: "Existing",
      framework: "Other",
      baseUrl: "http://existing",
    });
    const invalid = {
      version: 1,
      services: [
        {
          key: "duplicate",
          name: "First",
          apiType: "REST",
          framework: "Other",
          baseUrl: "http://first",
          endpoints: [],
        },
        {
          key: "duplicate",
          name: "Second",
          apiType: "REST",
          framework: "Other",
          baseUrl: "http://second",
          endpoints: [],
        },
      ],
    } as GraphCodeManifest;
    await expect(applyGraphCode(projectId, invalid, db!)).rejects.toThrow();
    const rows = await db!.select().from(services).where(eq(services.projectId, projectId));
    expect(rows.map(({ codeKey }) => codeKey)).toEqual(["existing"]);
  });

  it("rejects broker credentials that reference an unknown project variable", async () => {
    await expect(
      applyGraphCode(
        projectId,
        {
          version: 2,
          services: [],
          destinations: [
            {
              key: "orders-topic",
              broker: "kafka",
              name: "Orders",
              connection: { brokers: "kafka:9092", passwordVariable: "MISSING_PASSWORD" },
            },
          ],
          messageConnections: [],
        },
        db!,
      ),
    ).rejects.toThrow("unknown project variable");
  });

  it("creates and updates WebSocket mock APIs by graph-code key", async () => {
    const manifest: GraphCodeManifest = {
      version: 2,
      services: [
        {
          key: "push",
          name: "Notification Push Service",
          apiType: "WEBSOCKET",
          framework: "Spring Boot",
          baseUrl: "ws://localhost",
          endpoints: [
            {
              key: "notifications",
              name: "User notifications",
              url: "ws://localhost/ws/notifications?token=test-token-u1",
              outboundConnections: [],
            },
          ],
        },
      ],
      destinations: [],
      messageConnections: [],
      mockApis: [
        {
          key: "notification-stream",
          name: "Notification Stream",
          serviceKey: "push",
          endpointKey: "notifications",
          message: "ping",
        },
      ],
    };

    await applyGraphCode(projectId, manifest, db!);
    manifest.mockApis![0]!.message = "ping updated";
    await applyGraphCode(projectId, manifest, db!);
    const rows = await db!.select().from(mockApis).where(eq(mockApis.projectId, projectId));
    expect(
      rows.filter(({ description }) => description === "Graph code key: notification-stream"),
    ).toMatchObject([
      {
        name: "Notification Stream",
        apiType: "WEBSOCKET",
        requestJson: "ping updated",
      },
    ]);
    const canvas = await getCanvas(projectId, db!);
    expect(canvas.mockApis.filter(({ name }) => name === "Notification Stream")).toHaveLength(1);
    const trigger = canvas.mockApis.find(({ name }) => name === "Notification Stream");
    expect(trigger?.status).toBe("ready");
    const serviceEndpoint = canvas.services
      .flatMap(({ endpoints }) => endpoints)
      .find(({ name }) => name === "User notifications");
    expect(trigger?.targetEndpointId).toBe(serviceEndpoint?.id);
  });
});
