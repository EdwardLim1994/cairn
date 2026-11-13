export function recordOtlpBenchmark(kind: "traces" | "logs", phase: string, durationMs: number) {
  if (process.env.CAIRN_OTLP_BENCHMARK !== "1") return;
  console.log(JSON.stringify({ benchmark: "otlp", kind, phase, durationMs }));
}
