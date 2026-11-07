import type { CanvasGetResponse } from "#shared/api/canvas";
import type { GraphCodeManifest } from "#shared/api/graph-code";

type Service = CanvasGetResponse["services"][number];
type Edge = CanvasGetResponse["edges"][number];
type Destination = CanvasGetResponse["messageDestinations"][number];
type MessageConnection = CanvasGetResponse["messageConnections"][number];
type EndpointReference = { serviceKey: string; endpointKey: string };

function serviceDefinition(
  service: Service,
  endpointRefs: Map<string, EndpointReference>,
  edges: Edge[],
) {
  return {
    key: service.codeKey,
    name: service.name,
    apiType: service.apiType,
    framework: service.framework,
    baseUrl: service.baseUrl,
    ...(service.apiType === "GRPC" ? { grpcTls: service.grpcTls } : {}),
    ...(service.healthCheckUrl
      ? { healthCheck: { url: service.healthCheckUrl, headers: service.healthCheckCustomHeaders } }
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
  };
}

function messageConnectionDefinition(
  connection: MessageConnection,
  destinations: Map<string, Destination>,
  services: Service[],
  endpointRefs: Map<string, EndpointReference>,
): NonNullable<GraphCodeManifest["messageConnections"]>[number] | undefined {
  const destination = destinations.get(connection.destinationId);
  if (!destination) return undefined;
  if (connection.type === "publish") {
    const source = connection.endpointId ? endpointRefs.get(connection.endpointId) : undefined;
    const service = services.find(
      ({ id, codeKey }) => id === connection.serviceId || codeKey === source?.serviceKey,
    );
    if (!service) return undefined;
    return {
      type: "publish",
      destinationKey: destination.codeKey,
      serviceKey: service.codeKey,
      ...(source ? { endpointKey: source.endpointKey } : {}),
      ...(connection.routingKey ? { routingKey: connection.routingKey } : {}),
    };
  }
  const service = services.find(({ id }) => id === connection.serviceId);
  if (!service) return undefined;
  return {
    type: "subscribe",
    destinationKey: destination.codeKey,
    serviceKey: service.codeKey,
    ...(connection.consumerGroup ? { consumerGroup: connection.consumerGroup } : {}),
    ...(connection.bindingKey ? { bindingKey: connection.bindingKey } : {}),
  };
}

export function serializeGraphCode(
  services: CanvasGetResponse["services"],
  edges: CanvasGetResponse["edges"],
  destinations: CanvasGetResponse["messageDestinations"] = [],
  messageConnections: CanvasGetResponse["messageConnections"] = [],
  mockApis: CanvasGetResponse["mockApis"] = [],
) {
  if (!services.length && !destinations.length && !mockApis.length) return "";
  const endpointRefs = new Map(
    services.flatMap((service) =>
      service.endpoints.map((endpoint) => [
        endpoint.id,
        { serviceKey: service.codeKey, endpointKey: endpoint.codeKey },
      ]),
    ),
  );
  const serviceDefinitions = services.map((service) =>
    serviceDefinition(service, endpointRefs, edges),
  );
  const websocketMockApis = mockApis.flatMap((api) => {
    if (api.apiType !== "WEBSOCKET" || !api.targetEndpointId || typeof api.requestJson !== "string")
      return [];
    const endpoint = endpointRefs.get(api.targetEndpointId);
    if (!endpoint) return [];
    const graphCodeKey = /^Graph code key: (.+)$/.exec(api.description)?.[1];
    return [
      {
        key: graphCodeKey ?? `websocket-${api.id}`,
        name: api.name,
        serviceKey: endpoint.serviceKey,
        endpointKey: endpoint.endpointKey,
        message: api.requestJson,
      },
    ];
  });
  if (!destinations.length && !websocketMockApis.length)
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
  const connections = messageConnections.flatMap((connection) => {
    const definition = messageConnectionDefinition(
      connection,
      destinationById,
      services,
      endpointRefs,
    );
    return definition ? [definition] : [];
  });
  return JSON.stringify(
    {
      version: 2,
      services: serviceDefinitions,
      destinations: definitions,
      messageConnections: connections,
      ...(websocketMockApis.length ? { mockApis: websocketMockApis } : {}),
    },
    null,
    2,
  );
}
