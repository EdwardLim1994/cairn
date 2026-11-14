import type { LogRecord, SpanRecord } from "../../db/telemetry";
import { TelemetryRepository } from "./TelemetryRepository";

export { TelemetryRepository } from "./TelemetryRepository";

const telemetry = new TelemetryRepository();
export const addMockRunFailureLog = (
  input: Parameters<TelemetryRepository["addMockRunFailureLog"]>[0],
) => telemetry.addMockRunFailureLog(input);
export const queryLogs = (projectId: string, filters: { severities?: string[]; search?: string }) =>
  telemetry.queryLogs(projectId, filters);
export const listTelemetryServiceNames = (projectId: string) =>
  telemetry.listTelemetryServiceNames(projectId);
export const insertOtlpLogs = (records: LogRecord[]) => telemetry.insertOtlpLogs(records);
export const insertOtlpSpans = (records: SpanRecord[]) => telemetry.insertOtlpSpans(records);
export const readTelemetrySpans = (projectId: string, traceId: string) =>
  telemetry.readSpans(projectId, traceId);
