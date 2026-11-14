import { listMessageConnections } from "../graph-canvas";
import { listMessageDestinations } from "../message-destinations";
import { findMockApiTargetEndpointId } from "../mock-apis";
import { readTelemetrySpans } from "../observability";
import {
  findServiceExecutionDetails,
  listEndpointOwners,
  listServiceSummaries,
} from "../service-registry";
import { findRunRecord } from "../../repositories/runs";

/** Composes run metadata with owned service, graph, destination, and span reads. */
export async function getRunFlowData(projectId: string, id: string) {
  const run = await findRunRecord(projectId, id);
  if (!run) return undefined;
  const [spans, registeredServices, destinations, messageConnections, endpoints] =
    await Promise.all([
      readTelemetrySpans(projectId, run.traceId),
      listServiceSummaries(projectId),
      listMessageDestinations(projectId),
      listMessageConnections(projectId),
      listEndpointOwners(projectId),
    ]);
  let failedTargetService: string | undefined;
  if (run.status === "failed" && run.mockApiId) {
    const endpointId = await findMockApiTargetEndpointId(projectId, run.mockApiId);
    if (endpointId)
      failedTargetService = (await findServiceExecutionDetails(projectId, endpointId))?.serviceName;
  }
  return {
    run,
    spans,
    registeredServices,
    destinations,
    messageConnections,
    endpoints,
    failedTargetService,
  };
}
