import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { closeEmbeddedStores, initializeEmbeddedStores } from "./embedded";
import {
  readLogs,
  readSpans,
  cleanupTelemetry,
  startTelemetryWrites,
  stopTelemetryWrites,
  withTelemetryConnection,
  writeLogs,
  writeSpans,
} from "./telemetry";

afterEach(() => vi.unstubAllEnvs());

describe("DuckDB telemetry writer", () => {
  it("writes bounded batches and deduplicates repeated spans and logs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cairn-telemetry-writer-"));
    try {
      const stores = await initializeEmbeddedStores(directory);
      vi.stubEnv("TELEMETRY_BATCH_SIZE", "3");
      const now = new Date("2026-11-01T12:00:00.000Z");
      const spans = Array.from({ length: 11 }, (_, index) => ({
        projectId: "project-a",
        traceId: "a".repeat(32),
        spanId: index.toString(16).padStart(16, "0"),
        parentSpanId: null,
        serviceName: "orders",
        operationName: "GET /orders",
        startTime: now,
        endTime: now,
        statusCode: "OK",
        attributes: {},
      }));
      await writeSpans(spans);
      await writeSpans(spans);
      const logs = Array.from({ length: 11 }, (_, index) => ({
        projectId: "project-a",
        traceId: "a".repeat(32),
        serviceName: "orders",
        severity: "INFO",
        timestamp: now,
        message: `message ${index}`,
        attributes: {},
      }));
      await writeLogs(logs);
      await writeLogs(logs);
      const spanCount = await stores.telemetry.runAndReadAll("SELECT count(*) AS count FROM spans");
      const logCount = await stores.telemetry.runAndReadAll("SELECT count(*) AS count FROM logs");
      expect(Number(spanCount.getRowObjectsJson()[0]?.count)).toBe(11);
      expect(Number(logCount.getRowObjectsJson()[0]?.count)).toBe(11);
      const storedSpans = await readSpans("project-a", "a".repeat(32));
      expect(storedSpans).toHaveLength(11);
      expect(storedSpans[0]?.startTime).toEqual(now);
      expect(await readSpans("project-b", "a".repeat(32))).toEqual([]);
      expect(await readLogs("project-a", { search: "message 7" })).toContainEqual(
        expect.objectContaining({ projectId: "project-a", message: "message 7", timestamp: now }),
      );
      expect(await readLogs("project-b", {})).toEqual([]);
    } finally {
      closeEmbeddedStores();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects saturation and drains accepted work before shutdown", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cairn-telemetry-queue-"));
    let release!: () => void;
    try {
      await initializeEmbeddedStores(directory);
      startTelemetryWrites();
      vi.stubEnv("TELEMETRY_MAX_PENDING_RECORDS", "1");
      vi.stubEnv("TELEMETRY_MAX_PENDING_BYTES", "10000");
      const blocker = withTelemetryConnection(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      const record = {
        projectId: "a",
        traceId: null,
        serviceName: "orders",
        severity: "INFO",
        timestamp: new Date(),
        message: "queued",
        attributes: {},
      };
      const accepted = writeLogs([record]);
      await expect(writeLogs([record])).rejects.toMatchObject({ statusCode: 503 });
      const shutdown = stopTelemetryWrites();
      await expect(writeLogs([record])).rejects.toMatchObject({ statusCode: 503 });
      release();
      await blocker;
      await accepted;
      await shutdown;
      startTelemetryWrites();
      expect(await readLogs("a", {})).toHaveLength(1);
    } finally {
      release?.();
      closeEmbeddedStores();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("expires only records received before the retention cutoff", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cairn-telemetry-retention-"));
    try {
      const stores = await initializeEmbeddedStores(directory);
      startTelemetryWrites();
      const now = new Date("2026-11-13T00:00:00.000Z");
      const records = ["old", "new"].map((message) => ({
        projectId: "retention",
        traceId: "a".repeat(32),
        serviceName: "orders",
        severity: "INFO",
        timestamp: now,
        message,
        attributes: {},
      }));
      await writeLogs(records);
      await stores.telemetry.run(
        "UPDATE logs SET received_at = CAST(? AS TIMESTAMP) WHERE message = 'old'",
        ["2025-11-12T00:00:00.000Z"],
      );
      await stores.telemetry.run(
        "UPDATE logs SET received_at = CAST(? AS TIMESTAMP) WHERE message = 'new'",
        ["2025-11-14T00:00:00.000Z"],
      );
      await cleanupTelemetry(365, now);
      expect((await readLogs("retention", {})).map((record) => record.message)).toEqual(["new"]);
    } finally {
      closeEmbeddedStores();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rolls back a failed batch and accepts its retry", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cairn-telemetry-retry-"));
    try {
      await initializeEmbeddedStores(directory);
      startTelemetryWrites();
      const valid = {
        projectId: "retry-project",
        traceId: "a".repeat(32),
        spanId: "b".repeat(16),
        parentSpanId: null,
        serviceName: "orders",
        operationName: "retry",
        startTime: new Date(),
        endTime: new Date(),
        statusCode: "OK",
        attributes: {},
      };
      await expect(
        writeSpans([
          valid,
          { ...valid, projectId: null as unknown as string, spanId: "c".repeat(16) },
        ]),
      ).rejects.toThrow();
      expect(await readSpans("retry-project", valid.traceId)).toEqual([]);
      await writeSpans([valid]);
      expect(await readSpans("retry-project", valid.traceId)).toHaveLength(1);
      vi.stubEnv("TELEMETRY_MAX_PENDING_BYTES", "1");
      await expect(
        writeLogs([
          {
            projectId: "retry-project",
            traceId: null,
            serviceName: "orders",
            severity: "INFO",
            timestamp: new Date(),
            message: "too big",
            attributes: {},
          },
        ]),
      ).rejects.toMatchObject({ statusCode: 503 });
    } finally {
      closeEmbeddedStores();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
