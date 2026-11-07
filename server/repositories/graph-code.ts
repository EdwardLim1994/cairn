import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { GraphCodeManifest } from "#shared/api/graph-code";
import { arrangeGraph, messageQueueNodeId } from "#shared/utils/graph-layout";
import { getDb } from "../db";
import { deactivateInvalidMockApis } from "./mock-apis/reconcile-readiness";
import {
  environmentVariables,
  graphNodePositions,
  messageConnections,
  messageDestinations,
  mockApis,
  serviceEdges,
  serviceEndpoints,
  services,
} from "../db/schema";

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ServiceRow = typeof services.$inferSelect;
type EndpointRow = typeof serviceEndpoints.$inferSelect;
type DestinationRow = typeof messageDestinations.$inferSelect;
type DestinationDefinition = NonNullable<GraphCodeManifest["destinations"]>[number];
type PositionInput = {
  nodeType: "service" | "message_destination" | "message_queue";
  entityId: string;
  x: number;
  y: number;
};
type LayoutService = Parameters<typeof arrangeGraph>[0][number];
type LayoutDestination = NonNullable<Parameters<typeof arrangeGraph>[3]>[number];
type LayoutConnection = NonNullable<Parameters<typeof arrangeGraph>[4]>;
type PositionRow = typeof graphNodePositions.$inferSelect;
type PersistedMessageConnection = {
  type: "publish" | "subscribe";
  destinationId: string;
  endpointId: string | null;
  serviceId: string | null;
};

async function upsertServices(
  tx: Transaction,
  projectId: string,
  definitions: GraphCodeManifest["services"],
  oldServices: ServiceRow[],
  oldEndpoints: EndpointRow[],
) {
  const existingByKey = new Map(oldServices.map((service) => [service.codeKey, service]));
  const endpointsByService = new Map<string, EndpointRow[]>();
  for (const endpoint of oldEndpoints)
    endpointsByService.set(endpoint.serviceId, [
      ...(endpointsByService.get(endpoint.serviceId) ?? []),
      endpoint,
    ]);
  const nextServiceIds = new Map<string, string>();
  const nextEndpointIds = new Map<string, string>();
  await Promise.all(
    definitions.map(async (service) => {
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
        grpcTls: service.grpcTls,
        protoStorageKey: service.apiType === "GRPC" ? (existing?.protoStorageKey ?? null) : null,
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
      await Promise.all(
        service.endpoints.map(async (endpoint) => {
          const existingEndpoint = endpointsByKey.get(endpoint.key);
          const endpointId = existingEndpoint?.id ?? randomUUID();
          retainedIds.add(endpointId);
          nextEndpointIds.set(`${service.key}\0${endpoint.key}`, endpointId);
          const endpointValues = {
            projectId,
            serviceId,
            codeKey: endpoint.key,
            name: endpoint.name,
            method: endpoint.method ?? null,
            url: endpoint.url ?? null,
            rpcMethod: endpoint.rpcMethod ?? null,
          };
          if (existingEndpoint)
            await tx
              .update(serviceEndpoints)
              .set(endpointValues)
              .where(eq(serviceEndpoints.id, endpointId));
          else await tx.insert(serviceEndpoints).values({ id: endpointId, ...endpointValues });
        }),
      );
      const removedEndpoints = existingEndpoints
        .filter((endpoint) => !retainedIds.has(endpoint.id))
        .map((endpoint) => endpoint.id);
      if (removedEndpoints.length)
        await tx.delete(serviceEndpoints).where(inArray(serviceEndpoints.id, removedEndpoints));
    }),
  );
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
  return { nextServiceIds, nextEndpointIds };
}

async function upsertMockApis(
  tx: Transaction,
  projectId: string,
  definitions: NonNullable<GraphCodeManifest["mockApis"]>,
  endpointIds: Map<string, string>,
) {
  if (!definitions.length) return;
  const rows = await tx.select().from(mockApis).where(eq(mockApis.projectId, projectId));
  const oldByKey = new Map(
    rows.flatMap((row) => {
      const key = /^Graph code key: (.+)$/.exec(row.description)?.[1];
      return key ? [[key, row] as const] : [];
    }),
  );
  for (const definition of definitions) {
    const id = oldByKey.get(definition.key)?.id ?? randomUUID();
    const endpointId = endpointIds.get(`${definition.serviceKey}\0${definition.endpointKey}`);
    if (!endpointId)
      throw new GraphCodeConstraintError(`Unknown WebSocket endpoint for ${definition.name}`);
    const values = {
      projectId,
      name: definition.name,
      apiType: "WEBSOCKET" as const,
      targetEndpointId: endpointId,
      customHeaders: [],
      active: true,
      pathParameters: {},
      requestJson: definition.message,
      description: `Graph code key: ${definition.key}`,
    };
    if (oldByKey.has(definition.key))
      await tx.update(mockApis).set(values).where(eq(mockApis.id, id));
    else await tx.insert(mockApis).values({ id, ...values });
  }
}

async function upsertDestinations(
  tx: Transaction,
  projectId: string,
  definitions: DestinationDefinition[],
  oldDestinations: DestinationRow[],
) {
  const existingByKey = new Map(oldDestinations.map((item) => [item.codeKey, item]));
  const nextDestinationIds = new Map<string, string>();
  const nextQueueIds = new Map<string, string>();
  for (const destination of definitions) {
    const queueKey = destination.queueKey ?? "legacy-queue";
    if (nextQueueIds.has(queueKey)) continue;
    nextQueueIds.set(queueKey, existingByKey.get(destination.key)?.queueId ?? randomUUID());
  }
  await Promise.all(
    definitions.map(async (destination) => {
      const existing = existingByKey.get(destination.key);
      const id = existing?.id ?? randomUUID();
      nextDestinationIds.set(destination.key, id);
      const queueId = nextQueueIds.get(destination.queueKey ?? "legacy-queue")!;
      const values = {
        projectId,
        queueId,
        queueName: destination.queueName ?? "Message Queue",
        codeKey: destination.key,
        broker: destination.broker,
        name: destination.name,
        connection: destination.connection as Record<string, string | boolean | undefined>,
      };
      if (existing)
        await tx
          .update(messageDestinations)
          .set(values)
          .where(and(eq(messageDestinations.id, id), eq(messageDestinations.projectId, projectId)));
      else await tx.insert(messageDestinations).values({ id, ...values });
    }),
  );
  const retainedIds = new Set(nextDestinationIds.values());
  const removedIds = oldDestinations
    .filter((destination) => !retainedIds.has(destination.id))
    .map((destination) => destination.id);
  if (removedIds.length) {
    await tx
      .delete(graphNodePositions)
      .where(
        and(
          eq(graphNodePositions.projectId, projectId),
          eq(graphNodePositions.nodeType, "message_destination"),
          inArray(graphNodePositions.entityId, removedIds),
        ),
      );
    await tx
      .delete(messageDestinations)
      .where(
        and(
          eq(messageDestinations.projectId, projectId),
          inArray(messageDestinations.id, removedIds),
        ),
      );
  }
  return { nextDestinationIds, nextQueueIds };
}

async function validateBrokerVariables(
  tx: Transaction,
  projectId: string,
  definitions: DestinationDefinition[],
) {
  const names = [
    ...new Set(
      definitions.flatMap(({ connection }) =>
        connection.passwordVariable ? [connection.passwordVariable] : [],
      ),
    ),
  ];
  if (!names.length) return;
  const variables = await tx
    .select({ name: environmentVariables.name })
    .from(environmentVariables)
    .where(
      and(eq(environmentVariables.projectId, projectId), inArray(environmentVariables.name, names)),
    );
  if (variables.length !== names.length)
    throw new GraphCodeConstraintError(
      "Message broker connection references an unknown project variable",
    );
}

function buildInitialPositions(
  services: LayoutService[],
  edges: { sourceServiceId: string; targetEndpointId: string }[],
  destinations: LayoutDestination[],
  connections: LayoutConnection,
  queueIds: Map<string, string>,
  add: (type: PositionInput["nodeType"], id: string, point: { x: number; y: number }) => void,
) {
  const layout = arrangeGraph(services, edges, [], destinations, connections);
  for (const service of services) {
    const point = layout.get(service.id);
    if (point) add("service", service.id, point);
  }
  for (const queueId of new Set(queueIds.values())) {
    const point = layout.get(messageQueueNodeId(queueId));
    if (point) add("message_queue", queueId, point);
  }
}

function buildAppendedPositions(
  definitions: GraphCodeManifest["services"],
  oldServices: ServiceRow[],
  oldDestinations: DestinationRow[],
  oldPositions: PositionRow[],
  serviceIds: Map<string, string>,
  queueIds: Map<string, string>,
  add: (type: PositionInput["nodeType"], id: string, point: { x: number; y: number }) => void,
) {
  const positionByEntity = new Map(
    oldPositions.map((position) => [`${position.nodeType}:${position.entityId}`, position]),
  );
  const existingByKey = new Map(oldServices.map((service) => [service.codeKey, service]));
  const x = Math.max(0, ...oldPositions.map((position) => position.positionX)) + 720;
  let y = 0;
  for (const service of definitions) {
    const serviceId = serviceIds.get(service.key)!;
    const existing = existingByKey.get(service.key);
    const saved = existing && positionByEntity.get(`service:${existing.id}`);
    if (saved) add("service", serviceId, { x: saved.positionX, y: saved.positionY });
    else {
      add("service", serviceId, { x, y });
      y += Math.max(320, 218 + service.endpoints.length * 47);
    }
  }
  const oldQueuePositions = new Map<string, { x: number; y: number }>();
  for (const destination of oldDestinations) {
    if (oldQueuePositions.has(destination.queueId)) continue;
    const saved = positionByEntity.get(`message_queue:${destination.queueId}`);
    const legacy = positionByEntity.get(`message_destination:${destination.id}`);
    if (saved || legacy)
      oldQueuePositions.set(destination.queueId, {
        x: (saved ?? legacy)!.positionX,
        y: (saved ?? legacy)!.positionY,
      });
  }
  for (const [index, queueId] of [...new Set(queueIds.values())].entries()) {
    const saved = oldQueuePositions.get(queueId);
    add("message_queue", queueId, saved ?? { x, y: y + index * 320 });
  }
}

type GraphPositionContext = {
  definitions: GraphCodeManifest["services"];
  services: LayoutService[];
  edges: { sourceServiceId: string; targetEndpointId: string }[];
  destinations: LayoutDestination[];
  connections: LayoutConnection;
  oldServices: ServiceRow[];
  oldDestinations: DestinationRow[];
  oldPositions: PositionRow[];
  serviceIds: Map<string, string>;
  queueIds: Map<string, string>;
};

function buildGraphPositions(context: GraphPositionContext) {
  const {
    definitions,
    services,
    edges,
    destinations,
    connections,
    oldServices,
    oldDestinations,
    oldPositions,
    serviceIds,
    queueIds,
  } = context;
  const positions: PositionInput[] = [];
  const add = (
    nodeType: PositionInput["nodeType"],
    entityId: string,
    point: { x: number; y: number },
  ) => positions.push({ nodeType, entityId, ...point });
  if (oldServices.length === 0 && oldDestinations.length === 0)
    buildInitialPositions(services, edges, destinations, connections, queueIds, add);
  else
    buildAppendedPositions(
      definitions,
      oldServices,
      oldDestinations,
      oldPositions,
      serviceIds,
      queueIds,
      add,
    );
  return positions;
}

function toLayoutConnections(connections: PersistedMessageConnection[]): LayoutConnection {
  const result: LayoutConnection = [];
  for (const connection of connections) {
    if (connection.type === "publish" && (connection.endpointId || connection.serviceId))
      result.push({
        type: "publish",
        destinationId: connection.destinationId,
        ...(connection.endpointId ? { endpointId: connection.endpointId } : {}),
        ...(connection.serviceId ? { serviceId: connection.serviceId } : {}),
      });
    else if (connection.type === "subscribe" && connection.serviceId)
      result.push({
        type: "subscribe",
        destinationId: connection.destinationId,
        serviceId: connection.serviceId,
      });
  }
  return result;
}

export class GraphCodeConstraintError extends Error {}

export async function applyGraphCode(
  projectId: string,
  manifest: GraphCodeManifest,
  db: Database = getDb(),
) {
  await db.transaction(async (tx) => {
    const destinations = manifest.version === 2 ? (manifest.destinations ?? []) : [];
    const messageDefinitions = manifest.version === 2 ? (manifest.messageConnections ?? []) : [];
    await validateBrokerVariables(tx, projectId, destinations);

    const [oldServices, oldEndpoints, oldDestinations, oldPositions] = await Promise.all([
      tx.select().from(services).where(eq(services.projectId, projectId)),
      tx.select().from(serviceEndpoints).where(eq(serviceEndpoints.projectId, projectId)),
      tx.select().from(messageDestinations).where(eq(messageDestinations.projectId, projectId)),
      tx.select().from(graphNodePositions).where(eq(graphNodePositions.projectId, projectId)),
    ]);

    await tx.delete(serviceEdges).where(eq(serviceEdges.projectId, projectId));
    await tx.delete(messageConnections).where(eq(messageConnections.projectId, projectId));

    const { nextServiceIds, nextEndpointIds } = await upsertServices(
      tx,
      projectId,
      manifest.services,
      oldServices,
      oldEndpoints,
    );
    await upsertMockApis(
      tx,
      projectId,
      manifest.version === 2 ? (manifest.mockApis ?? []) : [],
      nextEndpointIds,
    );

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

    const { nextDestinationIds, nextQueueIds } = await upsertDestinations(
      tx,
      projectId,
      destinations,
      oldDestinations,
    );
    const nextMessageConnections = messageDefinitions.map((connection) => ({
      id: randomUUID(),
      projectId,
      destinationId: nextDestinationIds.get(connection.destinationKey)!,
      type: connection.type,
      endpointId:
        connection.type === "publish" && connection.endpointKey
          ? nextEndpointIds.get(`${connection.serviceKey}\0${connection.endpointKey}`)!
          : null,
      serviceId:
        connection.type === "subscribe" || !connection.endpointKey
          ? nextServiceIds.get(connection.serviceKey)!
          : null,
      consumerGroup: connection.type === "subscribe" ? (connection.consumerGroup ?? null) : null,
      routingKey: connection.type === "publish" ? (connection.routingKey ?? null) : null,
      bindingKey: connection.type === "subscribe" ? (connection.bindingKey ?? null) : null,
    }));
    const layoutConnections = toLayoutConnections(nextMessageConnections);
    if (nextMessageConnections.length)
      await tx.insert(messageConnections).values(nextMessageConnections);

    const nextServices = manifest.services.map((service) => ({
      id: nextServiceIds.get(service.key)!,
      name: service.name,
      endpoints: service.endpoints.map((endpoint) => ({
        id: nextEndpointIds.get(`${service.key}\0${endpoint.key}`)!,
      })),
    }));
    const nextDestinations = destinations.map((destination) => ({
      id: nextDestinationIds.get(destination.key)!,
      name: destination.name,
      queueId: nextQueueIds.get(destination.queueKey ?? "legacy-queue")!,
      queueName: destination.queueName ?? "Message Queue",
    }));
    const nextPositions = buildGraphPositions({
      definitions: manifest.services,
      services: nextServices,
      edges: nextEdges,
      destinations: nextDestinations,
      connections: layoutConnections,
      oldServices,
      oldDestinations,
      oldPositions,
      serviceIds: nextServiceIds,
      queueIds: nextQueueIds,
    });
    await Promise.all(
      nextPositions.map(({ nodeType, entityId, x, y }) =>
        tx
          .insert(graphNodePositions)
          .values({
            id: randomUUID(),
            projectId,
            nodeType,
            entityId,
            positionX: x,
            positionY: y,
          })
          .onDuplicateKeyUpdate({ set: { positionX: x, positionY: y } }),
      ),
    );
    await deactivateInvalidMockApis(tx, projectId);
  });
}
