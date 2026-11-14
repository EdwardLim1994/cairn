import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { changedRows } from "../../db/changes";
import { mockApiCallHistory, runs } from "../../db/schema";
export class RunRepository {
  constructor(private readonly db: ReturnType<typeof getDb>) {}

  async create(input: {
    projectId: string;
    mockApiId: string;
    id: string;
    traceId: string;
    mockApiName: string;
    method: string;
    url: string;
    requestBody: unknown;
  }) {
    const { projectId, mockApiId, id, traceId, mockApiName, method, url, requestBody } = input;
    const db = this.db;
    await db.transaction(async (transaction) => {
      await transaction
        .insert(runs)
        .values({ id, projectId, mockApiId, traceId, status: "running" });
      await transaction.insert(mockApiCallHistory).values({
        id,
        projectId,
        runId: id,
        mockApiId,
        mockApiName,
        method,
        url,
        requestBody,
        traceId,
        status: "running",
      });
    });
  }

  async finish(
    id: string,
    result: {
      status: "completed" | "failed";
      responseStatus?: number | null;
      grpcStatus?: number | null;
      grpcStatusName?: string | null;
      responseHeaders?: Record<string, string> | null;
      responseBody?: string | null;
      error: string | null;
    },
  ) {
    const db = this.db;
    await db.transaction(async (transaction) => {
      await transaction
        .update(runs)
        .set({ ...result, finishedAt: new Date() })
        .where(eq(runs.id, id));
      await transaction
        .update(mockApiCallHistory)
        .set({ status: result.status })
        .where(eq(mockApiCallHistory.runId, id));
    });
  }

  async find(projectId: string, id: string) {
    const [run] = await this.db
      .select()
      .from(runs)
      .where(and(eq(runs.id, id), eq(runs.projectId, projectId)));
    return (
      run && {
        ...run,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        lastTelemetryAt: run.lastTelemetryAt?.toISOString() ?? null,
      }
    );
  }

  async findRecord(projectId: string, id: string) {
    const [run] = await this.db
      .select()
      .from(runs)
      .where(and(eq(runs.id, id), eq(runs.projectId, projectId)));
    return run;
  }

  async listHistory(projectId: string) {
    const rows = await this.db
      .select({ history: mockApiCallHistory, run: runs })
      .from(mockApiCallHistory)
      .innerJoin(runs, eq(mockApiCallHistory.runId, runs.id))
      .where(eq(mockApiCallHistory.projectId, projectId))
      .orderBy(desc(mockApiCallHistory.triggeredAt), desc(mockApiCallHistory.id));
    return rows.map(({ history, run }) => ({
      ...history,
      triggeredAt: history.triggeredAt.toISOString(),
      responseStatus: run.responseStatus,
      grpcStatus: run.grpcStatus,
      grpcStatusName: run.grpcStatusName,
      responseHeaders: run.responseHeaders,
      responseBody: run.responseBody,
      error: run.error,
    }));
  }

  async deleteHistory(projectId: string, id: string): Promise<boolean> {
    const result = await this.db
      .delete(mockApiCallHistory)
      .where(and(eq(mockApiCallHistory.projectId, projectId), eq(mockApiCallHistory.id, id)));
    return changedRows(result) > 0;
  }

  async clearHistory(projectId: string): Promise<number> {
    const result = await this.db
      .delete(mockApiCallHistory)
      .where(eq(mockApiCallHistory.projectId, projectId));
    return changedRows(result);
  }

  /** Called after DuckDB accepts spans; retries may safely repeat this SQLite update. */
  async recordTelemetryArrival(projectId: string, traceIds: string[], acceptedAt: Date) {
    if (!traceIds.length) return;
    await this.db
      .update(runs)
      .set({
        lastTelemetryAt: acceptedAt,
        firstTelemetryAt: sql`coalesce(${runs.firstTelemetryAt}, ${acceptedAt.getTime()})`,
      })
      .where(and(eq(runs.projectId, projectId), inArray(runs.traceId, traceIds)));
  }
}
