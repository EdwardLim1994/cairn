import type { CanvasGetResponse } from "#shared/api/canvas";
import type { GraphCodeManifest } from "#shared/api/graph-code";

export function serializeGraphCode(
  services: CanvasGetResponse["services"],
  edges: CanvasGetResponse["edges"],
  destinations: CanvasGetResponse["messageDestinations"] = [],
  messageConnections: CanvasGetResponse["messageConnections"] = [],
) {
  if (!services.length && !destinations.length) return "";
  const endpointRefs = new Map(
    services.flatMap((service) =>
      service.endpoints.map((endpoint) => [
        endpoint.id,
        { serviceKey: service.codeKey, endpointKey: endpoint.codeKey },
      ]),
    ),
  );
  const serviceDefinitions = services.map((service) => ({
    key: service.codeKey,
    name: service.name,
    apiType: service.apiType,
    framework: service.framework,
    baseUrl: service.baseUrl,
    ...(service.apiType === "GRPC" ? { grpcTls: service.grpcTls } : {}),
    ...(service.healthCheckUrl
      ? {
          healthCheck: {
            url: service.healthCheckUrl,
            headers: service.healthCheckCustomHeaders,
          },
        }
      : {}),
    endpoints: service.endpoints.map((endpoint) => ({
      key: endpoint.codeKey,
      name: endpoint.name,
      ...(endpoint.method ? { method: endpoint.method } : {}),
      ...(endpoint.url ? { url: endpoint.url } : {}),
      ...(endpoint.rpcMethod ? { rpcMethod: endpoint.rpcMethod } : {}),
      outboundConnections: edges
        .filter((edge) => edge.sourceEndpointId === endpoint.id)
        .flatMap((edge) => {
          const target = endpointRefs.get(edge.targetEndpointId);
          return target ? [target] : [];
        }),
    })),
  }));
  if (!destinations.length)
    return JSON.stringify({ version: 1, services: serviceDefinitions }, null, 2);
  const destinationById = new Map(destinations.map((destination) => [destination.id, destination]));
  const definitions = destinations.map(
    ({ codeKey, queueId, queueName, broker, name, connection }) => ({
      key: codeKey,
      queueKey: queueId ?? "legacy-queue",
      queueName: queueName ?? "Message Queue",
      broker,
      name,
      connection,
    }),
  );
  const connections: NonNullable<GraphCodeManifest["messageConnections"]> = [];
  for (const connection of messageConnections) {
    const destination = destinationById.get(connection.destinationId);
    if (!destination) continue;
    if (connection.type === "publish") {
      const source = connection.endpointId ? endpointRefs.get(connection.endpointId) : undefined;
      const service = services.find(
        ({ id, codeKey }) => id === connection.serviceId || codeKey === source?.serviceKey,
      );
      if (!service) continue;
      connections.push({
        type: "publish",
        destinationKey: destination.codeKey,
        serviceKey: service.codeKey,
        ...(source ? { endpointKey: source.endpointKey } : {}),
        ...(connection.routingKey ? { routingKey: connection.routingKey } : {}),
      });
      continue;
    }
    const service = services.find(({ id }) => id === connection.serviceId);
    if (!service) continue;
    connections.push({
      type: "subscribe",
      destinationKey: destination.codeKey,
      serviceKey: service.codeKey,
      ...(connection.consumerGroup ? { consumerGroup: connection.consumerGroup } : {}),
      ...(connection.bindingKey ? { bindingKey: connection.bindingKey } : {}),
    });
  }
  return JSON.stringify(
    {
      version: destinations.length ? 2 : 1,
      services: serviceDefinitions,
      destinations: definitions,
      messageConnections: connections,
    },
    null,
    2,
  );
}
