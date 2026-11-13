import { createHash, randomBytes } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

const execFileAsync = promisify(execFile);
const projectId = "bench-otlp-project";
const port = 3197;
const baseUrl = `http://127.0.0.1:${port}`;
const token = randomBytes(32).toString("base64url");
const digest = createHash("sha256").update(token).digest("hex");
const output =
  process.argv[2] ?? "openspec/changes/sqlite-duckdb-storage-migration/benchmark-baseline.json";
const phases = {
  traces: { parse: [], normalize: [], write: [] },
  logs: { parse: [], normalize: [], write: [] },
};
const latencies = [];
const errors = [];
let serverOutput = "";

function payload(kind, batch) {
  const traceId = batch.toString(16).padStart(32, "0");
  const resource = {
    attributes: [
      { key: "service.name", value: { stringValue: "benchmark-service" } },
      { key: "project.id", value: { stringValue: projectId } },
    ],
  };
  if (kind === "traces") {
    return {
      resourceSpans: [
        {
          resource,
          scopeSpans: [
            {
              spans: Array.from({ length: 10 }, (_, i) => ({
                traceId,
                spanId: i.toString(16).padStart(16, "0"),
                name: "GET /benchmark",
                startTimeUnixNano: "1700000000000000000",
                endTimeUnixNano: "1700000000001000000",
                status: { code: 1 },
                attributes: [],
              })),
            },
          ],
        },
      ],
    };
  }
  return {
    resourceLogs: [
      {
        resource,
        scopeLogs: [
          {
            logRecords: Array.from({ length: 10 }, (_, i) => ({
              traceId,
              severityText: "INFO",
              timeUnixNano: "1700000000000000000",
              body: { stringValue: `benchmark log ${i}` },
              attributes: [],
            })),
          },
        ],
      },
    ],
  };
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

async function processMetrics(pid) {
  if (process.platform === "win32") {
    const script = `$p = Get-Process -Id ${pid} -ErrorAction Stop; Write-Output "$($p.CPU),$($p.WorkingSet64)"`;
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script]);
    const [cpu, rss] = stdout.trim().split(",").map(Number);
    return { cpuSeconds: cpu, rssBytes: rss };
  }
  const { readFile } = await import("node:fs/promises");
  const status = await readFile(`/proc/${pid}/status`, "utf8");
  const stat = (await readFile(`/proc/${pid}/stat`, "utf8")).split(" ");
  const rssBytes = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024;
  const cpuSeconds = (Number(stat[13]) + Number(stat[14])) / 100;
  return { cpuSeconds, rssBytes };
}

async function ready() {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/canvas`);
      if (response.ok) return;
    } catch {
      /* startup pending */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start: ${serverOutput.slice(-1000)}`);
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "cairn-otlp-bench-"));
  const db = new Database(join(dataDir, "cairn.sqlite"));
  let server;
  let sampling = false;
  let sampleTask;
  try {
    db.exec(await readFile("drizzle-sqlite/0000_remarkable_microbe.sql", "utf8"));
    db.pragma("user_version = 1");
    db.prepare("INSERT INTO projects (id) VALUES (?)").run(projectId);
    db.prepare(
      "INSERT INTO otel_access_tokens (id, project_id, name, digest) VALUES (?, ?, ?, ?)",
    ).run("bench-token", projectId, "benchmark", digest);
    db.close();
    server = spawn(process.execPath, [".output/server/index.mjs"], {
      env: {
        ...process.env,
        PROJECT_ID: projectId,
        OTEL_COLLECTOR_URL: "http://127.0.0.1:4318",
        AUTH_ENABLED: "false",
        CAIRN_DATA_DIR: dataDir,
        CAIRN_OTLP_BENCHMARK: "1",
        PORT: String(port),
        HOST: "127.0.0.1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [server.stdout, server.stderr]) {
      let pending = "";
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        serverOutput += chunk;
        pending += chunk;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop();
        for (const line of lines) {
          try {
            const item = JSON.parse(line);
            if (item.benchmark === "otlp") phases[item.kind][item.phase].push(item.durationMs);
          } catch {
            /* ordinary server output */
          }
        }
      });
    }
    await ready();
    const first = await processMetrics(server.pid);
    let peakRssBytes = first.rssBytes;
    sampling = true;
    sampleTask = (async () => {
      while (sampling) {
        try {
          peakRssBytes = Math.max(peakRssBytes, (await processMetrics(server.pid)).rssBytes);
        } catch {
          /* process may exit */
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })();
    const cases = [
      { kind: "traces", gzip: false, count: 8, concurrency: 1, batch: 1 },
      { kind: "logs", gzip: false, count: 8, concurrency: 1, batch: 100 },
      { kind: "traces", gzip: true, count: 8, concurrency: 4, batch: 200 },
      { kind: "logs", gzip: true, count: 8, concurrency: 4, batch: 300 },
      { kind: "traces", gzip: false, count: 2, concurrency: 1, batch: 1 },
      { kind: "logs", gzip: false, count: 2, concurrency: 1, batch: 100 },
    ];
    const sizes = {};
    let accepted = 0;
    const started = performance.now();
    for (const scenario of cases) {
      const requests = Array.from({ length: scenario.count }, (_, i) => {
        const body = Buffer.from(
          JSON.stringify(payload(scenario.kind, scenario.batch + (scenario.count === 2 ? 0 : i))),
        );
        const bytes = scenario.gzip ? gzipSync(body) : body;
        sizes[`${scenario.kind}-${scenario.gzip ? "gzip" : "plain"}`] = {
          jsonBytes: body.length,
          sentBytes: bytes.length,
        };
        return async () => {
          const requestStarted = performance.now();
          const response = await fetch(`${baseUrl}/v1/${scenario.kind}`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
              ...(scenario.gzip ? { "content-encoding": "gzip" } : {}),
            },
            body: bytes,
          });
          const result = await response.json();
          latencies.push(performance.now() - requestStarted);
          if (!response.ok) errors.push({ status: response.status, result });
          else accepted += result.accepted;
        };
      });
      for (let i = 0; i < requests.length; i += scenario.concurrency) {
        await Promise.all(requests.slice(i, i + scenario.concurrency).map((request) => request()));
      }
    }
    const elapsedSeconds = (performance.now() - started) / 1000;
    sampling = false;
    await sampleTask;
    const last = await processMetrics(server.pid);
    const report = {
      engine: "sqlite-duckdb",
      measuredAt: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      workload: { recordsPerRequest: 10, cases, sizes },
      results: {
        requests: latencies.length,
        accepted,
        errors,
        elapsedSeconds,
        acceptedPerSecond: accepted / elapsedSeconds,
        latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
        peakRssBytes,
        cpuSeconds: last.cpuSeconds - first.cpuSeconds,
        cpuPercentOfOneCore: ((last.cpuSeconds - first.cpuSeconds) / elapsedSeconds) * 100,
        phasesMs: Object.fromEntries(
          Object.entries(phases).map(([kind, values]) => [
            kind,
            Object.fromEntries(
              Object.entries(values).map(([phase, times]) => [
                phase,
                {
                  samples: times.length,
                  p50: percentile(times, 0.5),
                  p95: percentile(times, 0.95),
                },
              ]),
            ),
          ]),
        ),
      },
    };
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    sampling = false;
    await sampleTask;
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
    }
    if (db.open) db.close();
    await rm(dataDir, { recursive: true, force: true });
  }
}

await main();
