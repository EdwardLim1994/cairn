import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { getCanvas, saveCanvas } from "../../../repositories/canvas";
import { listBrokerHealthTargets } from "../../../repositories/message-destinations";
import { getDb } from "../../../db";
import {
  environmentVariables,
  graphNodePositions,
  messageConnections,
  messageDestinations,
  mockApis,
  projects,
  serviceEdges,
  serviceEndpoints,
  services,
} from "../../../db/schema";
import { CanvasConstraintError } from "../../../repositories/canvas/errors";

const integrationEnabled = process.env.CAIRN_RUN_INTEGRATION;
const integration = describe.skipIf(!integrationEnabled);

integration("canvas repositories with SQLite", () => {
  const projectId = "canvas-integration-project";
  let db: ReturnType<typeof getDb> | undefined;

  beforeAll(async () => {
    db = getDb();
  });

  beforeEach(async () => {
    await db!.delete(projects).where(eq(projects.id, projectId));
    await db!.insert(projects).values({ id: projectId });
    await db!.insert(services).values([
      {
        id: "canvas-service-source",
        projectId,
        name: "Source",
        framework: "Spring Boot",
        baseUrl: "http://localhost:8081",
      },
      {
        id: "canvas-service-target",
        projectId,
        name: "Target",
        framework: ".NET",
        baseUrl: "http://localhost:8082",
      },
    ]);
    await db!.insert(serviceEndpoints).values({
      id: "canvas-source-endpoint",
      projectId,
      serviceId: "canvas-service-source",
      name: "Source endpoint",
      method: "GET",
      url: "/source",
    });
    await db!.insert(serviceEndpoints).values({
      id: "canvas-target-endpoint",
      projectId,
      serviceId: "canvas-service-target",
      name: "Target endpoint",
      method: "POST",
      url: "/target",
    });
  });

  it("reads persisted canvas state and assembles endpoints under their services", async () => {
    await db!.insert(serviceEdges).values({
      id: "canvas-edge-1",
      projectId,
      sourceServiceId: "canvas-service-source",
      sourceEndpointId: null,
      targetEndpointId: "canvas-target-endpoint",
    });

    const canvas = await getCanvas(projectId, db!);

    expect(canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(canvas.nodesLocked).toBe(false);
    expect(canvas.services).toHaveLength(2);
    expect(
      canvas.services.find((service) => service.id === "canvas-service-target")?.endpoints,
    ).toHaveLength(1);
    expect(canvas.edges).toEqual([
      {
        id: "canvas-edge-1",
        sourceServiceId: "canvas-service-source",
        sourceEndpointId: null,
        sourceSubscriptionId: null,
        targetEndpointId: "canvas-target-endpoint",
      },
    ]);
  });

  it("saves service positions, viewport, and edges in one transaction", async () => {
    await saveCanvas(
      projectId,
      {
        nodesLocked: true,
        viewport: { x: 4, y: 5, zoom: 1.25 },
        services: [{ id: "canvas-service-source", x: 10, y: 11 }],
        edges: [
          {
            sourceServiceId: "canvas-service-source",
            sourceEndpointId: "canvas-source-endpoint",
            targetEndpointId: "canvas-target-endpoint",
          },
        ],
      },
      db!,
    );

    const canvas = await getCanvas(projectId, db!);
    expect(canvas.viewport).toEqual({ x: 4, y: 5, zoom: 1.25 });
    expect(canvas.nodesLocked).toBe(true);
    expect(canvas.services.find((service) => service.id === "canvas-service-source")).toMatchObject(
      { positionX: 10, positionY: 11 },
    );
    expect(canvas.edges).toHaveLength(1);
    expect(canvas.edges[0]).toMatchObject({ sourceEndpointId: "canvas-source-endpoint" });
  });

  it("round-trips Mock API positions separately from Mock API details", async () => {
    await db!.insert(mockApis).values({
      id: "canvas-mock-api",
      projectId,
      name: "Trigger",
      targetEndpointId: null,
      active: false,
      requestJson: {},
    });
    await saveCanvas(
      projectId,
      {
        nodesLocked: false,
        viewport: { x: 0, y: 0, zoom: 1 },
        services: [],
        mockApiPositions: [{ id: "canvas-mock-api", x: 90, y: 110 }],
        edges: [],
      },
      db!,
    );
    const canvas = await getCanvas(projectId, db!);
    expect(canvas.mockApis[0]).toMatchObject({
      id: "canvas-mock-api",
      positionX: 90,
      positionY: 110,
    });
    const detail = await db!.select().from(mockApis).where(eq(mockApis.id, "canvas-mock-api"));
    expect(detail[0]).not.toHaveProperty("positionX");
    expect(detail[0]).not.toHaveProperty("positionY");
  });

  it("round-trips assigned and legacy service-level connections", async () => {
    await saveCanvas(
      projectId,
      {
        nodesLocked: false,
        viewport: { x: 0, y: 0, zoom: 1 },
        services: [],
        edges: [
          { sourceServiceId: "canvas-service-source", targetEndpointId: "canvas-target-endpoint" },
          {
            sourceServiceId: "canvas-service-source",
            sourceEndpointId: "canvas-source-endpoint",
            targetEndpointId: "canvas-target-endpoint",
          },
        ],
      },
      db!,
    );

    const { edges } = await getCanvas(projectId, db!);
    expect(edges).toHaveLength(2);
    const sourceEndpointIds = edges.map(({ sourceEndpointId }) => sourceEndpointId);
    expect(sourceEndpointIds).toContain(null);
    expect(sourceEndpointIds).toContain("canvas-source-endpoint");
  });

  it("round-trips message destinations, typed connections, secrets, and positions", async () => {
    await db!
      .insert(environmentVariables)
      .values({ id: "canvas-broker-password", projectId, name: "KAFKA_PASSWORD", value: "secret" });
    await saveCanvas(
      projectId,
      {
        nodesLocked: false,
        viewport: { x: 0, y: 0, zoom: 1 },
        services: [],
        edges: [
          {
            sourceServiceId: "canvas-service-source",
            sourceSubscriptionId: "canvas-source-subscription",
            targetEndpointId: "canvas-target-endpoint",
          },
        ],
        messageDestinations: [
          {
            id: "canvas-destination-kafka",
            broker: "kafka",
            name: "orders",
            connection: { brokers: "localhost:9092", passwordVariable: "KAFKA_PASSWORD" },
            x: 150,
            y: 250,
          },
        ],
        messageConnections: [
          {
            type: "publish",
            destinationId: "canvas-destination-kafka",
            endpointId: "canvas-source-endpoint",
          },
          {
            type: "subscribe",
            id: "canvas-source-subscription",
            destinationId: "canvas-destination-kafka",
            serviceId: "canvas-service-source",
            consumerGroup: "orders-v1",
          },
          {
            type: "publish",
            id: "canvas-republish",
            destinationId: "canvas-destination-kafka",
            serviceId: "canvas-service-source",
            subscriptionId: "canvas-source-subscription",
          },
        ],
      },
      db!,
    );
    const canvas = await getCanvas(projectId, db!);
    expect(canvas.messageDestinations[0]).toMatchObject({
      id: "canvas-destination-kafka",
      broker: "kafka",
      x: 150,
      y: 250,
    });
    expect(canvas.messageConnections).toHaveLength(3);
    expect(canvas.edges).toContainEqual(
      expect.objectContaining({
        sourceSubscriptionId: "canvas-source-subscription",
        targetEndpointId: "canvas-target-endpoint",
      }),
    );
    expect(await listBrokerHealthTargets(projectId, db!)).toMatchObject([
      { id: "canvas-destination-kafka", password: "secret" },
    ]);
    expect(canvas.messageConnections).toContainEqual(
      expect.objectContaining({ type: "publish", endpointId: "canvas-source-endpoint" }),
    );
    expect(canvas.messageConnections).toContainEqual(
      expect.objectContaining({
        type: "subscribe",
        id: "canvas-source-subscription",
        serviceId: "canvas-service-source",
        consumerGroup: "orders-v1",
      }),
    );
    expect(canvas.messageConnections).toContainEqual(
      expect.objectContaining({
        type: "publish",
        id: "canvas-republish",
        subscriptionId: "canvas-source-subscription",
      }),
    );
    expect(
      await db!
        .select()
        .from(messageConnections)
        .where(eq(messageConnections.projectId, projectId)),
    ).toHaveLength(3);
    expect(
      await db!
        .select()
        .from(graphNodePositions)
        .where(eq(graphNodePositions.nodeType, "message_destination")),
    ).toMatchObject([
      {
        entityId: "canvas-destination-kafka",
        positionX: 150,
        positionY: 250,
      },
    ]);
    await saveCanvas(
      projectId,
      {
        nodesLocked: false,
        viewport: { x: 0, y: 0, zoom: 1 },
        services: [],
        edges: [],
        messageDestinations: [],
        messageConnections: [],
      },
      db!,
    );
    expect((await getCanvas(projectId, db!)).messageDestinations).toEqual([]);
    expect(
      await db!
        .select()
        .from(messageConnections)
        .where(eq(messageConnections.projectId, projectId)),
    ).toEqual([]);
  });

  it("migrates shared legacy queue positions to distinct destination positions", async () => {
    await db!.insert(messageDestinations).values([
      {
        id: "canvas-dest-a",
        projectId,
        queueId: "canvas-shared-queue",
        queueName: "Events",
        broker: "kafka",
        name: "orders.created",
        connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
      },
      {
        id: "canvas-dest-b",
        projectId,
        queueId: "canvas-shared-queue",
        queueName: "Events",
        broker: "kafka",
        name: "payments.created",
        connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
      },
    ]);
    await db!.insert(graphNodePositions).values({
      id: "canvas-legacy-queue-position",
      projectId,
      nodeType: "message_queue",
      entityId: "canvas-shared-queue",
      positionX: 420,
      positionY: 240,
    });
    await db!.insert(messageConnections).values([
      {
        id: "canvas-publish-a",
        projectId,
        destinationId: "canvas-dest-a",
        type: "publish",
        endpointId: "canvas-source-endpoint",
      },
      {
        id: "canvas-publish-b",
        projectId,
        destinationId: "canvas-dest-b",
        type: "publish",
        endpointId: "canvas-source-endpoint",
      },
    ]);

    const legacyCanvas = await getCanvas(projectId, db!);
    expect(legacyCanvas.messageDestinations.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: "canvas-dest-a", x: 420, y: 240 },
      { id: "canvas-dest-b", x: 420, y: 433 },
    ]);

    await saveCanvas(
      projectId,
      {
        nodesLocked: legacyCanvas.nodesLocked,
        viewport: legacyCanvas.viewport,
        services: legacyCanvas.services.map(({ id, positionX, positionY }) => ({
          id,
          x: positionX,
          y: positionY,
        })),
        edges: legacyCanvas.edges,
        messageDestinations: legacyCanvas.messageDestinations,
        messageConnections: legacyCanvas.messageConnections,
      },
      db!,
    );

    const migratedCanvas = await getCanvas(projectId, db!);
    expect(migratedCanvas.messageDestinations.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: "canvas-dest-a", x: 420, y: 240 },
      { id: "canvas-dest-b", x: 420, y: 433 },
    ]);
    expect(migratedCanvas.messageConnections).toHaveLength(2);
    expect(
      await db!
        .select()
        .from(graphNodePositions)
        .where(eq(graphNodePositions.nodeType, "message_destination")),
    ).toHaveLength(2);
    expect(
      await db!
        .select()
        .from(graphNodePositions)
        .where(eq(graphNodePositions.nodeType, "message_queue")),
    ).toHaveLength(0);
  });

  it("rejects cross-project message references without partial writes", async () => {
    const otherProjectId = "canvas-other-project";
    await db!.insert(projects).values({ id: otherProjectId });
    await db!.insert(services).values({
      id: "canvas-other-service",
      projectId: otherProjectId,
      name: "Other",
      framework: "Other",
      baseUrl: "http://localhost",
    });
    await db!.insert(serviceEndpoints).values({
      id: "canvas-other-endpoint",
      projectId: otherProjectId,
      serviceId: "canvas-other-service",
      name: "Other endpoint",
      method: "GET",
      url: "/other",
    });
    await expect(
      saveCanvas(
        projectId,
        {
          nodesLocked: true,
          viewport: { x: 4, y: 5, zoom: 1.2 },
          services: [],
          edges: [],
          messageDestinations: [
            {
              id: "canvas-new-destination",
              broker: "kafka",
              name: "new",
              connection: { brokers: "localhost:9092" },
              x: 1,
              y: 2,
            },
          ],
          messageConnections: [
            {
              type: "publish",
              destinationId: "canvas-new-destination",
              endpointId: "canvas-other-endpoint",
            },
          ],
        },
        db!,
      ),
    ).rejects.toBeInstanceOf(CanvasConstraintError);
    expect(
      await db!
        .select()
        .from(messageDestinations)
        .where(eq(messageDestinations.id, "canvas-new-destination")),
    ).toHaveLength(0);
    expect((await getCanvas(projectId, db!)).viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    await db!.delete(projects).where(eq(projects.id, otherProjectId));
  });

  it("keeps legacy calls service-level until reassignment, then reloads assigned endpoint", async () => {
    const base = {
      nodesLocked: false,
      viewport: { x: 0, y: 0, zoom: 1 },
      services: [],
    };
    await saveCanvas(
      projectId,
      {
        ...base,
        edges: [
          { sourceServiceId: "canvas-service-source", targetEndpointId: "canvas-target-endpoint" },
        ],
      },
      db!,
    );
    expect((await getCanvas(projectId, db!)).edges[0]?.sourceEndpointId).toBeNull();

    await saveCanvas(
      projectId,
      {
        ...base,
        edges: [
          {
            sourceServiceId: "canvas-service-source",
            sourceEndpointId: "canvas-source-endpoint",
            targetEndpointId: "canvas-target-endpoint",
          },
        ],
      },
      db!,
    );

    expect((await getCanvas(projectId, db!)).edges[0]).toMatchObject({
      sourceEndpointId: "canvas-source-endpoint",
      targetEndpointId: "canvas-target-endpoint",
    });
  });

  it("rejects a source endpoint owned by another service", async () => {
    await expect(
      saveCanvas(
        projectId,
        {
          nodesLocked: false,
          viewport: { x: 0, y: 0, zoom: 1 },
          services: [],
          edges: [
            {
              sourceServiceId: "canvas-service-source",
              sourceEndpointId: "canvas-target-endpoint",
              targetEndpointId: "canvas-target-endpoint",
            },
          ],
        },
        db!,
      ),
    ).rejects.toBeInstanceOf(CanvasConstraintError);
  });

  it("rolls back earlier writes when an edge references an unknown endpoint", async () => {
    await expect(
      saveCanvas(
        projectId,
        {
          nodesLocked: false,
          viewport: { x: 4, y: 5, zoom: 1 },
          services: [{ id: "canvas-service-source", x: 99, y: 99 }],
          edges: [
            { sourceServiceId: "canvas-service-source", targetEndpointId: "missing-endpoint" },
          ],
        },
        db!,
      ),
    ).rejects.toBeInstanceOf(CanvasConstraintError);

    const canvas = await getCanvas(projectId, db!);
    expect(canvas.services.find((service) => service.id === "canvas-service-source")).toMatchObject(
      { positionX: 0, positionY: 0 },
    );
    expect(canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});
