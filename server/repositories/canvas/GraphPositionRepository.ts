import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../../db";
import { graphNodePositions } from "../../db/schema";

type Transaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export class GraphPositionRepository {
  constructor(private readonly db: Transaction) {}

  createServicePosition(projectId: string, serviceId: string, x: number, y: number) {
    return this.db.insert(graphNodePositions).values({
      id: randomUUID(),
      projectId,
      nodeType: "service",
      entityId: serviceId,
      positionX: x,
      positionY: y,
    });
  }

  deleteServicePosition(projectId: string, serviceId: string) {
    return this.db
      .delete(graphNodePositions)
      .where(
        and(
          eq(graphNodePositions.projectId, projectId),
          eq(graphNodePositions.nodeType, "service"),
          eq(graphNodePositions.entityId, serviceId),
        ),
      );
  }

  deleteMockApiPosition(projectId: string, mockApiId: string) {
    return this.db
      .delete(graphNodePositions)
      .where(
        and(
          eq(graphNodePositions.projectId, projectId),
          eq(graphNodePositions.nodeType, "mock_api"),
          eq(graphNodePositions.entityId, mockApiId),
        ),
      );
  }

  deleteMockApiPositions(projectId: string, mockApiIds: string[]) {
    if (!mockApiIds.length) return Promise.resolve();
    return this.db
      .delete(graphNodePositions)
      .where(
        and(
          eq(graphNodePositions.projectId, projectId),
          eq(graphNodePositions.nodeType, "mock_api"),
          inArray(graphNodePositions.entityId, mockApiIds),
        ),
      );
  }
}
