import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { CanvasGetResponse, CanvasPutRequest } from "#shared/api/canvas";
import type { MessageDestinationInput } from "#shared/api/message-flows";
import { messageDestinationInputSchema } from "#shared/api/message-flows";
import type { AuthorizationTemplate } from "#shared/api/mock-apis";
import { getDb } from "../../db";
import {
  listMessageDestinations,
  MessageDestinationWriter,
} from "../../modules/message-destinations";
import { listMockApis } from "../../modules/mock-apis";
import {
  headerTemplates,
  authorizationTemplates,
  environmentVariables,
  graphNodePositions,
  messageConnections,
  mockApis,
  projects,
  serviceEdges,
  serviceEndpoints,
  services,
} from "../../db/schema";
import { CanvasConstraintError } from "./errors";

/** Canvas-specific persistence; multi-table writes stay within this domain module. */
type Database = ReturnType<typeof getDb>;

function assertCanvasConstraint(valid: boolean, message: string) {
  if (!valid) throw new CanvasConstraintError(message);
}

export class CanvasRepository {
  constructor(private readonly db: Database) {}
  async getCanvas(projectId: string): Promise<CanvasGetResponse> {
    const db = this.db;
    const [
      [project],
      serviceRows,
      endpoints,
      edges,
      positions,
      mockApiRows,
      templateRows,
      authTemplateRows,
      destinationRows,
      messageConnectionRows,
    ] = await Promise.all([
      db.select().from(projects).where(eq(projects.id, projectId)),
      db.select().from(services).where(eq(services.projectId, projectId)),
      db.select().from(serviceEndpoints).where(eq(serviceEndpoints.projectId, projectId)),
      db.select().from(serviceEdges).where(eq(serviceEdges.projectId, projectId)),
      db.select().from(graphNodePositions).where(eq(graphNodePositions.projectId, projectId)),
      listMockApis(projectId, db),
      db.select().from(headerTemplates).where(eq(headerTemplates.projectId, projectId)),
      db
        .select()
        .from(authorizationTemplates)
        .where(eq(authorizationTemplates.projectId, projectId)),
      listMessageDestinations(projectId, db),
      db.select().from(messageConnections).where(eq(messageConnections.projectId, projectId)),
    ]);
    if (!project) throw new Error("Project canvas could not be initialized");
    const positionByNode = new Map(
      positions.map((position) => [`${position.nodeType}:${position.entityId}`, position]),
    );
    return {
      nodesLocked: project.nodesLocked,
      viewport: { x: project.viewportX, y: project.viewportY, zoom: project.viewportZoom },
      services: serviceRows.map((service) => {
        const position = positionByNode.get(`service:${service.id}`);
        return {
          ...service,
          apiType: service.apiType as "REST" | "GRPC" | "WEBSOCKET",
          positionX: position?.positionX ?? 0,
          positionY: position?.positionY ?? 0,
          createdAt: service.createdAt.toISOString(),
          endpoints: endpoints
            .filter((endpoint) => endpoint.serviceId === service.id)
            .map((endpoint) => ({ ...endpoint, createdAt: endpoint.createdAt.toISOString() })),
        };
      }),
      edges: edges.map(
        ({ id, sourceServiceId, sourceEndpointId, sourceSubscriptionId, targetEndpointId }) => ({
          id,
          sourceServiceId,
          sourceEndpointId,
          sourceSubscriptionId,
          targetEndpointId,
        }),
      ),
      messageDestinations: destinationRows.map((destination) => {
        const siblings = destinationRows
          .filter((item) => item.queueId === destination.queueId)
          .toSorted((left, right) => left.id.localeCompare(right.id));
        const siblingIndex = siblings.findIndex((item) => item.id === destination.id);
        const savedDestinationPosition = positionByNode.get(
          `message_destination:${destination.id}`,
        );
        const legacyQueuePosition = positionByNode.get(`message_queue:${destination.queueId}`);
        const position = savedDestinationPosition ?? legacyQueuePosition;
        return {
          ...messageDestinationInputSchema.parse({
            ...destination,
            queueId: destination.queueId,
            connection: destination.connection as MessageDestinationInput["connection"],
            x: position?.positionX ?? 0,
            y:
              (position?.positionY ?? 0) +
              (!savedDestinationPosition && legacyQueuePosition ? siblingIndex * 193 : 0),
          }),
          projectId: destination.projectId,
          health: null,
        };
      }),
      messageConnections: messageConnectionRows.map((connection) => ({
        id: connection.id,
        type: connection.type,
        destinationId: connection.destinationId,
        ...(connection.endpointId ? { endpointId: connection.endpointId } : {}),
        ...(connection.subscriptionId ? { subscriptionId: connection.subscriptionId } : {}),
        ...(connection.serviceId ? { serviceId: connection.serviceId } : {}),
        ...(connection.consumerGroup ? { consumerGroup: connection.consumerGroup } : {}),
        ...(connection.routingKey !== null ? { routingKey: connection.routingKey } : {}),
        ...(connection.bindingKey !== null ? { bindingKey: connection.bindingKey } : {}),
      })) as CanvasGetResponse["messageConnections"],
      mockApis: mockApiRows.map((api) => {
        const position = api.id ? positionByNode.get(`mock_api:${api.id}`) : undefined;
        return {
          ...api,
          apiType: api.apiType as "HTTP" | "GRPC" | "WEBSOCKET",
          positionX: position?.positionX ?? null,
          positionY: position?.positionY ?? null,
        };
      }),
      headerTemplates: templateRows.map((template) => ({
        ...template,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      })),
      authorizationTemplates: authTemplateRows.map(
        (template) =>
          ({
            id: template.id,
            name: template.name,
            type: template.type,
            ...template.config,
            createdAt: template.createdAt.toISOString(),
            updatedAt: template.updatedAt.toISOString(),
          }) as AuthorizationTemplate,
      ),
    };
  }

  async saveCanvas(projectId: string, canvas: CanvasPutRequest): Promise<void> {
    const db = this.db;
    await db.transaction(async (tx) => {
      const destinations = canvas.messageDestinations ?? [];
      const connections = canvas.messageConnections ?? [];
      const destinationWriter = new MessageDestinationWriter(tx);
      const { existingDestinationIds, destinationIdSet } = await (async () => {
        const destinationIds = destinations.map(({ id }) => id);
        const existingDestinations = await destinationWriter.findExistingIds(destinationIds);
        const existingDestinationIds = new Set(existingDestinations.map(({ id }) => id));
        const ownedDestinationIds = existingDestinations.filter(
          ({ projectId: owner }) => owner === projectId,
        );
        assertCanvasConstraint(
          existingDestinationIds.size === ownedDestinationIds.length,
          "Message destination belongs to another project",
        );
        const destinationIdSet = new Set(destinationIds);
        assertCanvasConstraint(
          !connections.some(({ destinationId }) => !destinationIdSet.has(destinationId)),
          "Message connection references a destination outside this canvas",
        );
        const endpointIds = [
          ...new Set(
            connections.flatMap((connection) =>
              connection.type === "publish" && connection.endpointId ? [connection.endpointId] : [],
            ),
          ),
        ];
        const messageServiceIds = [
          ...new Set(
            connections.flatMap((connection) =>
              connection.serviceId ? [connection.serviceId] : [],
            ),
          ),
        ];
        const publishSubscriptionRefs = connections.flatMap((connection) =>
          connection.type === "publish" && connection.subscriptionId
            ? [{ id: connection.subscriptionId, serviceId: connection.serviceId }]
            : [],
        );
        const subscriptionOwners = new Map(
          connections.flatMap((connection) =>
            connection.type === "subscribe" && connection.id
              ? [[connection.id, connection.serviceId] as const]
              : [],
          ),
        );
        const [ownedMessageEndpoints, ownedConsumerServices] = await Promise.all([
          endpointIds.length
            ? tx
                .select({ id: serviceEndpoints.id })
                .from(serviceEndpoints)
                .where(
                  and(
                    eq(serviceEndpoints.projectId, projectId),
                    inArray(serviceEndpoints.id, endpointIds),
                  ),
                )
            : [],
          messageServiceIds.length
            ? tx
                .select({ id: services.id })
                .from(services)
                .where(
                  and(eq(services.projectId, projectId), inArray(services.id, messageServiceIds)),
                )
            : [],
        ]);
        assertCanvasConstraint(
          ownedMessageEndpoints.length === endpointIds.length &&
            ownedConsumerServices.length === messageServiceIds.length,
          "Message connection references a service or endpoint outside this project",
        );
        assertCanvasConstraint(
          !publishSubscriptionRefs.some(
            ({ id, serviceId }) =>
              !subscriptionOwners.has(id) || subscriptionOwners.get(id) !== serviceId,
          ),
          "A message publish must reference a subscription owned by its source service",
        );
        const variableNames = [
          ...new Set(
            destinations.flatMap(({ connection }) =>
              connection.passwordVariable ? [connection.passwordVariable] : [],
            ),
          ),
        ];
        if (variableNames.length) {
          const knownVariables = await tx
            .select({ name: environmentVariables.name })
            .from(environmentVariables)
            .where(
              and(
                eq(environmentVariables.projectId, projectId),
                inArray(environmentVariables.name, variableNames),
              ),
            );
          assertCanvasConstraint(
            knownVariables.length === variableNames.length,
            "Message broker connection references an unknown project variable",
          );
        }
        return { existingDestinationIds, destinationIdSet };
      })();
      const oldDestinationRows = await destinationWriter.listIds(projectId);
      const removedDestinationIds = oldDestinationRows
        .map(({ id }) => id)
        .filter((id) => !destinationIdSet.has(id));
      await tx.delete(messageConnections).where(eq(messageConnections.projectId, projectId));
      if (removedDestinationIds.length) {
        await tx
          .delete(graphNodePositions)
          .where(
            and(
              eq(graphNodePositions.projectId, projectId),
              eq(graphNodePositions.nodeType, "message_destination"),
              inArray(graphNodePositions.entityId, removedDestinationIds),
            ),
          );
        await destinationWriter.deleteIds(projectId, removedDestinationIds);
      }
      await tx
        .delete(graphNodePositions)
        .where(
          and(
            eq(graphNodePositions.projectId, projectId),
            eq(graphNodePositions.nodeType, "message_queue"),
          ),
        );
      await destinationWriter.upsert(projectId, destinations, existingDestinationIds);
      await Promise.all(
        destinations.map((destination) =>
          tx
            .insert(graphNodePositions)
            .values({
              id: randomUUID(),
              projectId,
              nodeType: "message_destination",
              entityId: destination.id,
              positionX: destination.x,
              positionY: destination.y,
            })
            .onConflictDoUpdate({
              target: [
                graphNodePositions.projectId,
                graphNodePositions.nodeType,
                graphNodePositions.entityId,
              ],
              set: { positionX: destination.x, positionY: destination.y },
            }),
        ),
      );
      if (connections.length)
        await tx.insert(messageConnections).values(
          [...connections]
            .sort(
              (left, right) =>
                Number(right.type === "subscribe") - Number(left.type === "subscribe"),
            )
            .map((connection) => ({
              id: connection.id ?? randomUUID(),
              projectId,
              destinationId: connection.destinationId,
              type: connection.type,
              endpointId: connection.type === "publish" ? (connection.endpointId ?? null) : null,
              subscriptionId:
                connection.type === "publish" ? (connection.subscriptionId ?? null) : null,
              serviceId: connection.serviceId ?? null,
              consumerGroup:
                connection.type === "subscribe" ? (connection.consumerGroup ?? null) : null,
              routingKey: connection.type === "publish" ? (connection.routingKey ?? null) : null,
              bindingKey: connection.type === "subscribe" ? (connection.bindingKey ?? null) : null,
            })),
        );
      const serviceIds = canvas.services.map(({ id }) => id);
      if (serviceIds.length) {
        const owned = await tx
          .select({ id: services.id })
          .from(services)
          .where(and(eq(services.projectId, projectId), inArray(services.id, serviceIds)));
        assertCanvasConstraint(
          owned.length === new Set(serviceIds).size,
          "Canvas contains an unknown or duplicate service",
        );
        await Promise.all(
          canvas.services.map((position) =>
            tx
              .insert(graphNodePositions)
              .values({
                id: randomUUID(),
                projectId,
                nodeType: "service",
                entityId: position.id,
                positionX: position.x,
                positionY: position.y,
              })
              .onConflictDoUpdate({
                target: [
                  graphNodePositions.projectId,
                  graphNodePositions.nodeType,
                  graphNodePositions.entityId,
                ],
                set: { positionX: position.x, positionY: position.y },
              }),
          ),
        );
      }
      const mockApiPositions = canvas.mockApiPositions ?? [];
      const mockApiIds = mockApiPositions.map(({ id }) => id);
      if (mockApiIds.length) {
        const owned = await tx
          .select({ id: mockApis.id })
          .from(mockApis)
          .where(and(eq(mockApis.projectId, projectId), inArray(mockApis.id, mockApiIds)));
        assertCanvasConstraint(
          owned.length === new Set(mockApiIds).size,
          "Canvas contains an unknown or duplicate mock API",
        );
        await Promise.all(
          mockApiPositions.map((position) =>
            tx
              .insert(graphNodePositions)
              .values({
                id: randomUUID(),
                projectId,
                nodeType: "mock_api",
                entityId: position.id,
                positionX: position.x,
                positionY: position.y,
              })
              .onConflictDoUpdate({
                target: [
                  graphNodePositions.projectId,
                  graphNodePositions.nodeType,
                  graphNodePositions.entityId,
                ],
                set: { positionX: position.x, positionY: position.y },
              }),
          ),
        );
      }
      if (canvas.edges.length) {
        const sourceIds = [...new Set(canvas.edges.map(({ sourceServiceId }) => sourceServiceId))];
        const endpointIds = [
          ...new Set(
            canvas.edges.flatMap(({ sourceEndpointId, targetEndpointId }) =>
              sourceEndpointId ? [sourceEndpointId, targetEndpointId] : [targetEndpointId],
            ),
          ),
        ];
        const subscriptionIds = [
          ...new Set(
            canvas.edges.flatMap(({ sourceSubscriptionId }) =>
              sourceSubscriptionId ? [sourceSubscriptionId] : [],
            ),
          ),
        ];
        const [ownedServices, ownedEndpoints, ownedSubscriptions] = await Promise.all([
          tx
            .select({ id: services.id })
            .from(services)
            .where(and(eq(services.projectId, projectId), inArray(services.id, sourceIds))),
          tx
            .select({ id: serviceEndpoints.id, serviceId: serviceEndpoints.serviceId })
            .from(serviceEndpoints)
            .where(
              and(
                eq(serviceEndpoints.projectId, projectId),
                inArray(serviceEndpoints.id, endpointIds),
              ),
            ),
          subscriptionIds.length
            ? tx
                .select({ id: messageConnections.id, serviceId: messageConnections.serviceId })
                .from(messageConnections)
                .where(
                  and(
                    eq(messageConnections.projectId, projectId),
                    inArray(messageConnections.id, subscriptionIds),
                    eq(messageConnections.type, "subscribe"),
                  ),
                )
            : [],
        ]);
        assertCanvasConstraint(
          ownedServices.length === sourceIds.length &&
            ownedEndpoints.length === endpointIds.length &&
            ownedSubscriptions.length === subscriptionIds.length,
          "Connection references a service or endpoint outside this project",
        );
        const endpointOwners = new Map(
          ownedEndpoints.map((endpoint) => [endpoint.id, endpoint.serviceId]),
        );
        assertCanvasConstraint(
          !canvas.edges.some(
            (edge) =>
              endpointOwners.get(edge.targetEndpointId) === edge.sourceServiceId ||
              (edge.sourceEndpointId &&
                endpointOwners.get(edge.sourceEndpointId) !== edge.sourceServiceId) ||
              (edge.sourceSubscriptionId &&
                !ownedSubscriptions.some(
                  ({ id, serviceId }) =>
                    id === edge.sourceSubscriptionId && serviceId === edge.sourceServiceId,
                )),
          ),
          "A service cannot connect to its own endpoint or use another service's endpoint as source",
        );
      }
      await tx
        .update(projects)
        .set({
          nodesLocked: canvas.nodesLocked,
          viewportX: canvas.viewport.x,
          viewportY: canvas.viewport.y,
          viewportZoom: canvas.viewport.zoom,
        })
        .where(eq(projects.id, projectId));
      await tx.delete(serviceEdges).where(eq(serviceEdges.projectId, projectId));
      if (canvas.edges.length)
        await tx.insert(serviceEdges).values(
          canvas.edges.map((edge) => ({
            id: randomUUID(),
            projectId,
            ...edge,
            sourceEndpointId: edge.sourceEndpointId ?? null,
            sourceSubscriptionId: edge.sourceSubscriptionId ?? null,
          })),
        );
    });
  }
}
