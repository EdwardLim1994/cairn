import type { RunGetResponse } from "#shared/api/observability";
import { RunNotFoundError } from "../../repositories/runs/errors";

export function createGetRunUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  findRun: (projectId: string, id: string) => Promise<RunGetResponse | undefined>;
}) {
  return async (id: string): Promise<RunGetResponse> => {
    const run = await dependencies.findRun(await dependencies.ensureProject(), id);
    if (!run) throw new RunNotFoundError("Run not found");
    return {
      ...run,
      startedAt: new Date(run.startedAt).toISOString(),
      finishedAt: run.finishedAt ? new Date(run.finishedAt).toISOString() : null,
      lastTelemetryAt: run.lastTelemetryAt ? new Date(run.lastTelemetryAt).toISOString() : null,
    };
  };
}
