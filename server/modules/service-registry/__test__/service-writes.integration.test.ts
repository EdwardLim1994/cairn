import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getDb, type SqliteTransaction } from "../../../db";
import { graphNodePositions, projects, services } from "../../../db/schema";
import { GraphPositionRepository } from "../../graph-canvas";
import { ServiceWriteRepository } from "../index";
import { createCreateServiceUseCase } from "../../../use-cases/services/create-service";
import { createDeleteServiceUseCase } from "../../../use-cases/services/delete-service";
import { createUpdateServiceUseCase } from "../../../use-cases/services/update-service";

const integration = describe.skipIf(!process.env.CAIRN_RUN_INTEGRATION);
const projectId = "service-write-integration";
const otherProjectId = "service-write-other";
const input = {
  name: "Orders",
  apiType: "REST" as const,
  framework: "Spring Boot",
  baseUrl: "http://localhost:8081",
  grpcTls: false,
  healthCheckUrl: null,
  healthCheckHeaderTemplateId: null,
  healthCheckCustomHeaders: [],
  active: true,
  endpoints: [],
  positionX: 12,
  positionY: 34,
};

integration("service use-case transactions", () => {
  let db: ReturnType<typeof getDb>;
  const removeProtoFile = vi.fn().mockResolvedValue(undefined);
  const putProtoFile = vi.fn().mockResolvedValue(undefined);
  const transaction = <T>(work: (tx: SqliteTransaction) => Promise<T>) => db.transaction(work);
  const createPosition = async (
    tx: SqliteTransaction,
    project: string,
    id: string,
    x: number,
    y: number,
  ) => {
    await new GraphPositionRepository(tx).createServicePosition(project, id, x, y);
  };
  const deletePosition = async (tx: SqliteTransaction, project: string, id: string) => {
    await new GraphPositionRepository(tx).deleteServicePosition(project, id);
  };
  const create = (project = projectId, position = createPosition) =>
    createCreateServiceUseCase({
      ensureProject: async () => project,
      transaction,
      createService: (tx, p, id, data, key) =>
        new ServiceWriteRepository(tx).create(p, id, data, key),
      createPosition: position,
      putProtoFile,
      removeProtoFile,
      newId: () => (project === otherProjectId ? "service-2" : "service-1"),
    });
  const update = (project = projectId, reconcileReadiness = vi.fn().mockResolvedValue(undefined)) =>
    createUpdateServiceUseCase({
      ensureProject: async () => project,
      transaction,
      findProto: (tx, p, id) => new ServiceWriteRepository(tx).findProto(p, id),
      updateService: (tx, p, id, data, key, fileName) =>
        new ServiceWriteRepository(tx).update(p, id, data, key, fileName),
      reconcileReadiness,
      putProtoFile,
      removeProtoFile,
    });
  const remove = (project = projectId, reconcileReadiness = vi.fn().mockResolvedValue(undefined)) =>
    createDeleteServiceUseCase({
      ensureProject: async () => project,
      transaction,
      deleteService: (tx, p, id) => new ServiceWriteRepository(tx).delete(p, id),
      deletePosition,
      reconcileReadiness,
      removeProtoFile,
    });

  beforeAll(() => {
    db = getDb();
  });

  beforeEach(async () => {
    await db.delete(projects).where(eq(projects.id, projectId));
    await db.delete(projects).where(eq(projects.id, otherProjectId));
    await db.insert(projects).values([{ id: projectId }, { id: otherProjectId }]);
    vi.clearAllMocks();
  });

  it("creates service rows and graph position atomically", async () => {
    await expect(create()(input)).resolves.toEqual({ id: "service-1" });
    expect(await db.select().from(services).where(eq(services.projectId, projectId))).toHaveLength(
      1,
    );
    expect(
      await db.select().from(graphNodePositions).where(eq(graphNodePositions.projectId, projectId)),
    ).toMatchObject([{ entityId: "service-1", positionX: 12, positionY: 34 }]);
    const failPosition = vi.fn().mockRejectedValue(new Error("position failed"));
    await expect(create(otherProjectId, failPosition)(input)).rejects.toThrow("position failed");
    expect(
      await db.select().from(services).where(eq(services.projectId, otherProjectId)),
    ).toHaveLength(0);
  });

  it("rejects another project's service and rolls back failed readiness updates", async () => {
    await create()(input);
    await expect(update(otherProjectId)("service-1", { ...input, name: "Changed" })).resolves.toBe(
      "not-found",
    );
    await expect(
      update(projectId, vi.fn().mockRejectedValue(new Error("readiness failed")))("service-1", {
        ...input,
        name: "Changed",
      }),
    ).rejects.toThrow("readiness failed");
    const [saved] = await db.select().from(services).where(eq(services.id, "service-1"));
    expect(saved?.name).toBe("Orders");
  });

  it("rolls back service and graph deletion when readiness fails", async () => {
    await create()(input);
    await expect(remove(otherProjectId)("service-1")).resolves.toBeNull();
    await expect(
      remove(projectId, vi.fn().mockRejectedValue(new Error("readiness failed")))("service-1"),
    ).rejects.toThrow("readiness failed");
    expect(await db.select().from(services).where(eq(services.id, "service-1"))).toHaveLength(1);
    expect(
      await db
        .select()
        .from(graphNodePositions)
        .where(
          and(
            eq(graphNodePositions.projectId, projectId),
            eq(graphNodePositions.entityId, "service-1"),
          ),
        ),
    ).toHaveLength(1);
  });
});
