# OTLP migration benchmark

The machine-readable measurements are in `benchmark-baseline.json` and `benchmark-post.json`. Both runs used the same 36 requests and 360 accepted records: ten records per request, plain and gzip JSON, sequential and four-way concurrent requests, followed by repeated trace and log batches. The payload sizes match exactly: 2,379-byte plain traces, 1,842-byte plain logs, 259-byte gzip traces, and 252-byte gzip logs. Neither run returned an HTTP error.

| Metric                     |   MySQL baseline | SQLite/DuckDB after migration |
| -------------------------- | ---------------: | ----------------------------: |
| Accepted records/s         |            1,420 |                           507 |
| Response p50 / p95         |  9.55 / 17.52 ms |              27.08 / 80.86 ms |
| Peak server RSS            |           247 MB |                        235 MB |
| Server CPU during requests |          0.172 s |                       2.063 s |
| Trace parse p50 / p95      | 0.112 / 1.456 ms |              0.181 / 1.816 ms |
| Log parse p50 / p95        | 0.084 / 0.350 ms |              0.132 / 0.472 ms |
| Trace normalize p50 / p95  | 0.072 / 0.476 ms |              0.063 / 0.477 ms |
| Log normalize p50 / p95    | 0.067 / 0.339 ms |              0.053 / 0.304 ms |
| Trace write p50 / p95      |  8.83 / 10.19 ms |              27.01 / 83.02 ms |
| Log write p50 / p95        |   1.14 / 2.05 ms |              13.63 / 42.23 ms |

The post-migration run is slower on this small workload: about 64% lower throughput, 2.8 times higher median latency, and 4.6 times higher p95 latency. Write time dominates the regression. The new writer commits each request to DuckDB and the trace path then updates SQLite; the baseline used MySQL. This is a single local run, so it does not establish sustained capacity. The baseline used Node 22 and the post-migration run used Node 26 on the same Windows host, which limits direct causal attribution. Both runs include server startup in peak RSS and measure CPU only during the request window.

Reproduce the post-migration measurement with:

```powershell
vp run build
node scripts/bench-otlp.mjs openspec/changes/sqlite-duckdb-storage-migration/benchmark-post.json
```

The script starts the built server with disposable SQLite and DuckDB files, seeds one access token, and measures opt-in parse, normalization, and write phases with `CAIRN_OTLP_BENCHMARK=1`. It removes the files after the server exits. The JSON files retain exact measurements and workload definitions.
