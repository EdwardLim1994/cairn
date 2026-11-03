import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { getCanvas, saveCanvas } from ".";
import * as schema from "../../db/schema";
import { mockApis, projects, serviceEdges, serviceEndpoints, services } from "../../db/schema";
import { CanvasConstraintError } from "./errors";

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("canvas repositories with MySQL", () => {
  const projectId = "canvas-integration-project";
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
      apiType: "REST",
      method: "GET",
      url: "/source",
    });
    await db!.insert(serviceEndpoints).values({
      id: "canvas-target-endpoint",
      projectId,
      serviceId: "canvas-service-target",
      name: "Target endpoint",
      apiType: "REST",
      method: "POST",
      url: "/target",
    });
  });

  afterAll(async () => {
    await pool?.end();
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
