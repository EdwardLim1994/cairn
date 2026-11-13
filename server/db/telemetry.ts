import { createHash } from "node:crypto";
import { createError } from "h3";
import { getEmbeddedStores } from "./embedded";
import { getTelemetryWriterLimits } from "../utils/config";

export type SpanRecord = {
  projectId: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  serviceName: string;
  operationName: string;
  startTime: Date;
  endTime: Date;
  statusCode: string;
  attributes: Record<string, unknown>;
};

export type LogRecord = {
  projectId: string;
  traceId: string | null;
  serviceName: string;
  severity: string;
  timestamp: Date;
  message: string;
  attributes: Record<string, unknown>;
  id?: string;
};

let pending = Promise.resolve();
let pendingRecords = 0;
let pendingBytes = 0;
let stopping = false;

export function startTelemetryWrites() {
  stopping = false;
}

export async function stopTelemetryWrites() {
  stopping = true;
  await pending;
}

function queueTelemetryWrite<T>(records: number, bytes: number, work: () => Promise<T>) {
  const limits = getTelemetryWriterLimits();
  if (stopping || pendingRecords + records > limits.records || pendingBytes + bytes > limits.bytes)
    throw createError({
      statusCode: 503,
      statusMessage: "Telemetry writer is busy; retry the request",
    });
  pendingRecords += records;
  pendingBytes += bytes;
  return withTelemetryConnection(work).finally(() => {
    pendingRecords -= records;
    pendingBytes -= bytes;
  });
}

export function withTelemetryConnection<T>(work: () => Promise<T>): Promise<T> {
  const result = pending.then(work);
  pending = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function logIdentity(record: LogRecord, position: number): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        record.projectId,
        record.traceId,
        record.serviceName,
        record.severity,
        record.timestamp.toISOString(),
        record.message,
        record.attributes,
        position,
      ]),
    )
    .digest("hex");
}

export async function writeSpans(records: SpanRecord[]) {
  if (!records.length) return;
  await queueTelemetryWrite(
    records.length,
    Buffer.byteLength(JSON.stringify(records)),
    async () => {
      const connection = getEmbeddedStores().telemetry;
      const batchSize = getTelemetryWriterLimits().batchSize;
      await connection.run("BEGIN TRANSACTION");
      try {
        for (let offset = 0; offset < records.length; offset += batchSize) {
          const batch = records.slice(offset, offset + batchSize);
          const placeholders = batch
            .map(
              () =>
                "(?, ?, ?, ?, ?, ?, CAST(? AS TIMESTAMP), CAST(? AS TIMESTAMP), ?, CAST(? AS JSON))",
            )
            .join(", ");
          const values = batch.flatMap((record) => [
            record.projectId,
            record.traceId,
            record.spanId,
            record.parentSpanId,
            record.serviceName,
            record.operationName,
            record.startTime.toISOString(),
            record.endTime.toISOString(),
            record.statusCode,
            JSON.stringify(record.attributes),
          ]);
          await connection.run(
            `INSERT INTO spans (project_id, trace_id, span_id, parent_span_id, service_name, operation_name, start_time, end_time, status_code, attributes) VALUES ${placeholders}
         ON CONFLICT (project_id, trace_id, span_id) DO UPDATE SET
           parent_span_id = excluded.parent_span_id,
           service_name = excluded.service_name,
           operation_name = excluded.operation_name,
           start_time = excluded.start_time,
           end_time = excluded.end_time,
           status_code = excluded.status_code,
           attributes = excluded.attributes`,
            values,
          );
        }
        await connection.run("COMMIT");
      } catch (error) {
        await connection.run("ROLLBACK");
        throw error;
      }
    },
  );
}

export async function writeLogs(records: LogRecord[]) {
  if (!records.length) return;
  await queueTelemetryWrite(
    records.length,
    Buffer.byteLength(JSON.stringify(records)),
    async () => {
      const connection = getEmbeddedStores().telemetry;
      const batchSize = getTelemetryWriterLimits().batchSize;
      await connection.run("BEGIN TRANSACTION");
      try {
        for (let offset = 0; offset < records.length; offset += batchSize) {
          const batch = records.slice(offset, offset + batchSize);
          const placeholders = batch
            .map(() => "(?, ?, ?, ?, ?, CAST(? AS TIMESTAMP), ?, CAST(? AS JSON))")
            .join(", ");
          const values = batch.flatMap((record, index) => [
            record.id ?? logIdentity(record, offset + index),
            record.projectId,
            record.traceId,
            record.serviceName,
            record.severity,
            record.timestamp.toISOString(),
            record.message,
            JSON.stringify(record.attributes),
          ]);
          await connection.run(
            `INSERT INTO logs (id, project_id, trace_id, service_name, severity, timestamp, message, attributes) VALUES ${placeholders} ON CONFLICT (id) DO NOTHING`,
            values,
          );
        }
        await connection.run("COMMIT");
      } catch (error) {
        await connection.run("ROLLBACK");
        throw error;
      }
    },
  );
}

function asDate(value: number | bigint): Date {
  return new Date(Number(value));
}

function asAttributes(value: unknown): Record<string, unknown> {
  return typeof value === "string" ? JSON.parse(value) : (value as Record<string, unknown>);
}

type SpanRow = {
  project_id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  service_name: string;
  operation_name: string;
  start_time_ms: number | bigint;
  end_time_ms: number | bigint;
  status_code: string;
  attributes: string | Record<string, unknown>;
  received_at_ms: number | bigint;
};

type LogRow = {
  id: string;
  project_id: string;
  trace_id: string | null;
  service_name: string;
  severity: string;
  timestamp_ms: number | bigint;
  message: string;
  attributes: string | Record<string, unknown>;
  received_at_ms: number | bigint;
};

export async function readSpans(projectId: string, traceId: string) {
  return withTelemetryConnection(async () => {
    const result = await getEmbeddedStores().telemetry.runAndReadAll(
      "SELECT *, epoch_ms(start_time) AS start_time_ms, epoch_ms(end_time) AS end_time_ms, epoch_ms(received_at) AS received_at_ms FROM spans WHERE project_id = ? AND trace_id = ? ORDER BY start_time",
      [projectId, traceId],
    );
    return (result.getRowObjectsJS() as unknown as SpanRow[]).map((row) => ({
      id: `${row.project_id}:${row.trace_id}:${row.span_id}`,
      projectId: row.project_id,
      traceId: row.trace_id,
      spanId: row.span_id,
      parentSpanId: row.parent_span_id,
      serviceName: row.service_name,
      operationName: row.operation_name,
      startTime: asDate(row.start_time_ms),
      endTime: asDate(row.end_time_ms),
      statusCode: row.status_code,
      attributes: asAttributes(row.attributes),
      receivedAt: asDate(row.received_at_ms),
    }));
  });
}

export async function readLogs(
  projectId: string,
  filters: { severities?: string[]; search?: string },
) {
  return withTelemetryConnection(async () => {
    const conditions = ["project_id = ?"];
    const values: string[] = [projectId];
    if (filters.severities?.length) {
      conditions.push(`severity IN (${filters.severities.map(() => "?").join(", ")})`);
      values.push(...filters.severities);
    }
    if (filters.search) {
      conditions.push("message LIKE ? ESCAPE '\\'");
      values.push(`%${filters.search}%`);
    }
    const result = await getEmbeddedStores().telemetry.runAndReadAll(
      `SELECT *, epoch_ms(timestamp) AS timestamp_ms, epoch_ms(received_at) AS received_at_ms FROM logs WHERE ${conditions.join(" AND ")} ORDER BY timestamp DESC, id DESC LIMIT 500`,
      values,
    );
    return (result.getRowObjectsJS() as unknown as LogRow[]).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      traceId: row.trace_id,
      serviceName: row.service_name,
      severity: row.severity,
      timestamp: asDate(row.timestamp_ms),
      message: row.message,
      attributes: asAttributes(row.attributes),
      receivedAt: asDate(row.received_at_ms),
    }));
  });
}

export async function cleanupTelemetry(retentionDays: number, now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  await withTelemetryConnection(async () => {
    const connection = getEmbeddedStores().telemetry;
    await connection.run("BEGIN TRANSACTION");
    try {
      await connection.run("DELETE FROM spans WHERE received_at < CAST(? AS TIMESTAMP)", [cutoff]);
      await connection.run("DELETE FROM logs WHERE received_at < CAST(? AS TIMESTAMP)", [cutoff]);
      await connection.run("COMMIT");
    } catch (error) {
      await connection.run("ROLLBACK");
      throw error;
    }
  });
}
