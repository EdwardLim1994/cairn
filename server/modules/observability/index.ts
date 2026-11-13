// Public telemetry operations. Span and log persistence remains in DuckDB.
export {
  addMockRunFailureLog,
  queryLogs,
  listTelemetryServiceNames,
  insertOtlpLogs,
  insertOtlpSpans,
} from "../../repositories/telemetry";
