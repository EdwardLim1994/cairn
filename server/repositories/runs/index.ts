import { getDb } from "../../db";
import { RunRepository } from "./RunRepository";

export { RunRepository } from "./RunRepository";

export const createRun = (input: Parameters<RunRepository["create"]>[0]) =>
  new RunRepository(getDb()).create(input);
export const finishRun = (id: string, result: Parameters<RunRepository["finish"]>[1]) =>
  new RunRepository(getDb()).finish(id, result);
export const findRun = (projectId: string, id: string) =>
  new RunRepository(getDb()).find(projectId, id);
export const findRunRecord = (projectId: string, id: string) =>
  new RunRepository(getDb()).findRecord(projectId, id);
export const listMockApiCallHistory = (projectId: string) =>
  new RunRepository(getDb()).listHistory(projectId);
export const deleteMockApiCallHistory = (projectId: string, id: string) =>
  new RunRepository(getDb()).deleteHistory(projectId, id);
export const clearMockApiCallHistory = (projectId: string) =>
  new RunRepository(getDb()).clearHistory(projectId);
export const recordTelemetryArrival = (projectId: string, traceIds: string[], acceptedAt: Date) =>
  new RunRepository(getDb()).recordTelemetryArrival(projectId, traceIds, acceptedAt);
