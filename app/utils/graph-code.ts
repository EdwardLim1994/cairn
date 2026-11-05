import type { CanvasGetResponse } from "#shared/api/canvas";

export function serializeGraphCode(
  services: CanvasGetResponse["services"],
  edges: CanvasGetResponse["edges"],
) {
  if (!services.length) return "";
  const endpointRefs = new Map(
    services.flatMap((service) =>
      service.endpoints.map((endpoint) => [
        endpoint.id,
        { serviceKey: service.codeKey, endpointKey: endpoint.codeKey },
      ]),
    ),
  );
  return JSON.stringify(
    {
      version: 1,
      services: services.map((service) => ({
        key: service.codeKey,
        name: service.name,
        apiType: service.apiType,
        framework: service.framework,
        baseUrl: service.baseUrl,
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
          method: endpoint.method,
          url: endpoint.url,
          outboundConnections: edges
            .filter((edge) => edge.sourceEndpointId === endpoint.id)
            .flatMap((edge) => {
              const target = endpointRefs.get(edge.targetEndpointId);
              return target ? [target] : [];
            }),
        })),
      })),
    },
    null,
    2,
  );
}
