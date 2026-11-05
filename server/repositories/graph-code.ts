import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { GraphCodeManifest } from "#shared/api/graph-code";
import { arrangeGraph } from "#shared/utils/graph-layout";
import { getDb } from "../db";
import { deactivateInvalidMockApis } from "./mock-apis/reconcile-readiness";
import { graphNodePositions, serviceEdges, serviceEndpoints, services } from "../db/schema";

type Database = ReturnType<typeof getDb>;

export async function applyGraphCode(
  projectId: string,
  manifest: GraphCodeManifest,
  db: Database = getDb(),
) {
  await db.transaction(async (tx) => {
    const [oldServices, oldEndpoints, oldPositions] = await Promise.all([
      tx.select().from(services).where(eq(services.projectId, projectId)),
      tx.select().from(serviceEndpoints).where(eq(serviceEndpoints.projectId, projectId)),
      tx.select().from(graphNodePositions).where(eq(graphNodePositions.projectId, projectId)),
    ]);
    const existingByKey = new Map(oldServices.map((service) => [service.codeKey, service]));
    const endpointsByService = new Map<string, typeof oldEndpoints>();
    for (const endpoint of oldEndpoints)
      endpointsByService.set(endpoint.serviceId, [
        ...(endpointsByService.get(endpoint.serviceId) ?? []),
        endpoint,
      ]);

    await tx.delete(serviceEdges).where(eq(serviceEdges.projectId, projectId));

    const nextServiceIds = new Map<string, string>();
    const nextEndpointIds = new Map<string, string>();
    for (const service of manifest.services) {
      const existing = existingByKey.get(service.key);
      const serviceId = existing?.id ?? randomUUID();
      nextServiceIds.set(service.key, serviceId);
      const serviceValues = {
        projectId,
        codeKey: service.key,
        name: service.name,
        apiType: service.apiType,
        framework: service.framework,
        baseUrl: service.baseUrl,
        healthCheckUrl: service.healthCheck?.url ?? null,
        healthCheckHeaderTemplateId: null,
        healthCheckCustomHeaders: service.healthCheck?.headers ?? [],
        active: existing?.active ?? true,
      };
      if (existing) await tx.update(services).set(serviceValues).where(eq(services.id, serviceId));
      else await tx.insert(services).values({ id: serviceId, ...serviceValues });

      const existingEndpoints = endpointsByService.get(serviceId) ?? [];
      const endpointsByKey = new Map(
        existingEndpoints.map((endpoint) => [endpoint.codeKey, endpoint]),
      );
      const retainedIds = new Set<string>();
      for (const endpoint of service.endpoints) {
        const existingEndpoint = endpointsByKey.get(endpoint.key);
        const endpointId = existingEndpoint?.id ?? randomUUID();
        retainedIds.add(endpointId);
        nextEndpointIds.set(`${service.key}\0${endpoint.key}`, endpointId);
        const endpointValues = {
          projectId,
          serviceId,
          codeKey: endpoint.key,
          name: endpoint.name,
          method: endpoint.method,
          url: endpoint.url,
        };
        if (existingEndpoint)
          await tx
            .update(serviceEndpoints)
            .set(endpointValues)
            .where(eq(serviceEndpoints.id, endpointId));
        else await tx.insert(serviceEndpoints).values({ id: endpointId, ...endpointValues });
      }
      const removedEndpoints = existingEndpoints
        .filter((endpoint) => !retainedIds.has(endpoint.id))
        .map((endpoint) => endpoint.id);
      if (removedEndpoints.length)
        await tx.delete(serviceEndpoints).where(inArray(serviceEndpoints.id, removedEndpoints));
    }

    const retainedServiceIds = new Set(nextServiceIds.values());
    const removedServiceIds = oldServices
      .filter((service) => !retainedServiceIds.has(service.id))
      .map((service) => service.id);
    if (removedServiceIds.length) {
      await tx
        .delete(graphNodePositions)
        .where(
          and(
            eq(graphNodePositions.projectId, projectId),
            eq(graphNodePositions.nodeType, "service"),
            inArray(graphNodePositions.entityId, removedServiceIds),
          ),
        );
      await tx.delete(services).where(inArray(services.id, removedServiceIds));
    }

    const nextEdges = manifest.services.flatMap((service) =>
      service.endpoints.flatMap((endpoint) =>
        endpoint.outboundConnections.map((connection) => ({
          id: randomUUID(),
          projectId,
          sourceServiceId: nextServiceIds.get(service.key)!,
          sourceEndpointId: nextEndpointIds.get(`${service.key}\0${endpoint.key}`)!,
          targetEndpointId: nextEndpointIds.get(
            `${connection.serviceKey}\0${connection.endpointKey}`,
          )!,
        })),
      ),
    );
    if (nextEdges.length) await tx.insert(serviceEdges).values(nextEdges);

    const positionByEntity = new Map(
      oldPositions.map((position) => [`${position.nodeType}:${position.entityId}`, position]),
    );
    const nextServices = manifest.services.map((service) => ({
      id: nextServiceIds.get(service.key)!,
      name: service.name,
      endpoints: service.endpoints.map((endpoint) => ({
        id: nextEndpointIds.get(`${service.key}\0${endpoint.key}`)!,
      })),
    }));
    const nextPositions = new Map<string, { x: number; y: number }>();
    if (oldServices.length === 0) {
      const layout = arrangeGraph(nextServices, nextEdges, []);
      for (const service of nextServices) {
        const position = layout.get(service.id);
        if (position) nextPositions.set(service.id, position);
      }
    } else {
      const x = Math.max(0, ...oldPositions.map((position) => position.positionX)) + 720;
      let y = 0;
      for (const service of manifest.services) {
        const serviceId = nextServiceIds.get(service.key)!;
        const existing = existingByKey.get(service.key);
        const saved = existing && positionByEntity.get(`service:${existing.id}`);
        if (existing && saved)
          nextPositions.set(serviceId, { x: saved.positionX, y: saved.positionY });
        else if (existing) nextPositions.set(serviceId, { x: 0, y: 0 });
        else {
          nextPositions.set(serviceId, { x, y });
          y += Math.max(320, 218 + service.endpoints.length * 47);
        }
      }
    }
    await Promise.all(
      [...nextPositions].map(([entityId, position]) =>
        tx
          .insert(graphNodePositions)
          .values({
            id: randomUUID(),
            projectId,
            nodeType: "service",
            entityId,
            positionX: position.x,
            positionY: position.y,
          })
          .onDuplicateKeyUpdate({ set: { positionX: position.x, positionY: position.y } }),
      ),
    );
    await deactivateInvalidMockApis(tx, projectId);
  });
}
