import { and, eq, inArray } from "drizzle-orm";
import type { SqliteTransaction } from "../../db";
import { serviceEndpoints, services } from "../../db/schema";

/** Exposes endpoint ownership and service protocol to other modules. */
export class ServiceEndpointReader {
  constructor(private readonly db: SqliteTransaction) {}

  async listDetails(projectId: string, ids: string[]) {
    if (!ids.length) return [];
    return this.db
      .select({
        id: serviceEndpoints.id,
        url: serviceEndpoints.url,
        serviceApiType: services.apiType,
      })
      .from(serviceEndpoints)
      .innerJoin(services, eq(serviceEndpoints.serviceId, services.id))
      .where(and(eq(serviceEndpoints.projectId, projectId), inArray(serviceEndpoints.id, ids)));
  }

  async findDetail(projectId: string, id: string) {
    const [endpoint] = await this.listDetails(projectId, [id]);
    return endpoint;
  }

  async findExecutionDetails(projectId: string, id: string) {
    const [endpoint] = await this.db
      .select({
        endpointId: serviceEndpoints.id,
        method: serviceEndpoints.method,
        endpointUrl: serviceEndpoints.url,
        rpcMethod: serviceEndpoints.rpcMethod,
        serviceApiType: services.apiType,
        baseUrl: services.baseUrl,
        grpcTls: services.grpcTls,
        protoStorageKey: services.protoStorageKey,
        serviceName: services.name,
      })
      .from(serviceEndpoints)
      .innerJoin(services, eq(serviceEndpoints.serviceId, services.id))
      .where(and(eq(serviceEndpoints.projectId, projectId), eq(serviceEndpoints.id, id)));
    return endpoint;
  }
}
