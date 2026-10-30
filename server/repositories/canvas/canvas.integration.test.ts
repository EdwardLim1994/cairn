import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { getCanvas, saveCanvas } from ".";
import * as schema from "../../db/schema";
import { projects, serviceEdges, serviceEndpoints, services } from "../../db/schema";
import { CanvasConstraintError } from "./errors";

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("canvas repositories with MySQL", () => {
  const projectId = "canvas-integration-project";
  const pool = mysql.createPool(connectionString!);
  const db = drizzle({ client: pool, schema, mode: "default" });

  beforeAll(async () => {
    await pool.query("SELECT 1");
  });

  beforeEach(async () => {
    await db.delete(projects).where(eq(projects.id, projectId));
    await db.insert(projects).values({ id: projectId });
    await db.insert(services).values([
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
    await db.insert(serviceEndpoints).values({
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
    await pool.end();
  });

  it("reads persisted canvas state and assembles endpoints under their services", async () => {
    await db.insert(serviceEdges).values({
      id: "canvas-edge-1",
      projectId,
      sourceServiceId: "canvas-service-source",
      targetEndpointId: "canvas-target-endpoint",
    });

    const canvas = await getCanvas(projectId, db);

    expect(canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(canvas.services).toHaveLength(2);
    expect(
      canvas.services.find((service) => service.id === "canvas-service-target")?.endpoints,
    ).toHaveLength(1);
    expect(canvas.edges).toEqual([
      {
        id: "canvas-edge-1",
        sourceServiceId: "canvas-service-source",
        targetEndpointId: "canvas-target-endpoint",
      },
    ]);
  });

  it("saves positions, viewport, mock node, and edges in one transaction", async () => {
    await saveCanvas(
      projectId,
      {
        viewport: { x: 4, y: 5, zoom: 1.25 },
        mockNode: { x: 8, y: 9 },
        services: [{ id: "canvas-service-source", x: 10, y: 11 }],
        edges: [
          { sourceServiceId: "canvas-service-source", targetEndpointId: "canvas-target-endpoint" },
        ],
      },
      db,
    );

    const canvas = await getCanvas(projectId, db);
    expect(canvas.viewport).toEqual({ x: 4, y: 5, zoom: 1.25 });
    expect(canvas.mockNode).toEqual({ x: 8, y: 9 });
    expect(canvas.services.find((service) => service.id === "canvas-service-source")).toMatchObject(
      { positionX: 10, positionY: 11 },
    );
    expect(canvas.edges).toHaveLength(1);
  });

  it("rolls back earlier writes when an edge references an unknown endpoint", async () => {
    await expect(
      saveCanvas(
        projectId,
        {
          viewport: { x: 4, y: 5, zoom: 1 },
          mockNode: { x: 8, y: 9 },
          services: [{ id: "canvas-service-source", x: 99, y: 99 }],
          edges: [
            { sourceServiceId: "canvas-service-source", targetEndpointId: "missing-endpoint" },
          ],
        },
        db,
      ),
    ).rejects.toBeInstanceOf(CanvasConstraintError);

    const canvas = await getCanvas(projectId, db);
    expect(canvas.services.find((service) => service.id === "canvas-service-source")).toMatchObject(
      { positionX: 0, positionY: 0 },
    );
    expect(canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});
