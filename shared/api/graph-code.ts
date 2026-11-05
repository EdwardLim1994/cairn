import { z } from "zod";

const frameworkSchema = z.enum(["Spring Boot", ".NET", "Other"]);
const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const keySchema = z.string().trim().min(1).max(128);
const headerSchema = z.object({ name: z.string(), value: z.string() });
const outboundConnectionSchema = z.object({ serviceKey: keySchema, endpointKey: keySchema });
const endpointSchema = z.object({
  key: keySchema,
  name: z.string().trim().min(1).max(255),
  method: methodSchema.nullable().optional(),
  url: z.string().trim().min(1).max(2048).nullable().optional(),
  rpcMethod: z.string().trim().min(1).max(512).nullable().optional(),
  outboundConnections: z.array(outboundConnectionSchema),
});
const serviceSchema = z
  .object({
    key: keySchema,
    name: z.string().trim().min(1).max(255),
    apiType: z.enum(["REST", "GRPC"]).default("REST"),
    framework: frameworkSchema,
    baseUrl: z.string().trim().min(1).max(2048),
    grpcTls: z.boolean().default(false),
    healthCheck: z
      .object({
        url: z
          .string()
          .trim()
          .min(1)
          .max(2048)
          .refine(
            (url) => /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//")),
            "Expected HTTP URL or service path",
          ),
        headers: z.array(headerSchema),
      })
      .optional(),
    endpoints: z.array(endpointSchema),
  })
  .superRefine((service, context) => {
    if (service.apiType === "REST" && !/^https?:\/\//i.test(service.baseUrl))
      context.addIssue({ code: "custom", path: ["baseUrl"], message: "Expected HTTP URL" });
    if (service.apiType === "GRPC") {
      const match = /^(?:\[[^\]]+\]|[^:/?#\s]+):(\d{1,5})$/.exec(service.baseUrl);
      const port = match ? Number(match[1]) : 0;
      if (!match || port < 1 || port > 65535)
        context.addIssue({
          code: "custom",
          path: ["baseUrl"],
          message: "Expected host:port gRPC target",
        });
    }
    service.endpoints.forEach((endpoint, index) => {
      if (service.apiType === "REST" && (!endpoint.method || !endpoint.url || endpoint.rpcMethod))
        context.addIssue({
          code: "custom",
          path: ["endpoints", index],
          message: "REST endpoints need method and URL",
        });
      if (service.apiType === "GRPC" && (!endpoint.rpcMethod || endpoint.method || endpoint.url))
        context.addIssue({
          code: "custom",
          path: ["endpoints", index],
          message: "gRPC endpoints need an RPC method",
        });
    });
  });

export const graphCodeManifestSchema = z
  .object({ version: z.literal(1), services: z.array(serviceSchema) })
  .superRefine(({ services }, context) => {
    const serviceByKey = new Map<string, z.infer<typeof serviceSchema>>();
    services.forEach((service, serviceIndex) => {
      if (serviceByKey.has(service.key))
        context.addIssue({
          code: "custom",
          path: ["services", serviceIndex, "key"],
          message: `Duplicate service key: ${service.key}`,
        });
      else serviceByKey.set(service.key, service);
    });

    services.forEach((service, serviceIndex) => {
      const endpointKeys = new Set<string>();
      service.endpoints.forEach((endpoint, endpointIndex) => {
        if (endpointKeys.has(endpoint.key))
          context.addIssue({
            code: "custom",
            path: ["services", serviceIndex, "endpoints", endpointIndex, "key"],
            message: `Duplicate endpoint key: ${endpoint.key}`,
          });
        endpointKeys.add(endpoint.key);

        const targets = new Set<string>();
        endpoint.outboundConnections.forEach((connection, connectionIndex) => {
          const target = `${connection.serviceKey}\0${connection.endpointKey}`;
          const path = [
            "services",
            serviceIndex,
            "endpoints",
            endpointIndex,
            "outboundConnections",
            connectionIndex,
          ];
          if (targets.has(target))
            context.addIssue({
              code: "custom",
              path,
              message: "Duplicate outbound connection",
            });
          targets.add(target);
          const targetService = serviceByKey.get(connection.serviceKey);
          const targetEndpoint = targetService?.endpoints.find(
            (candidate) => candidate.key === connection.endpointKey,
          );
          if (!targetService || !targetEndpoint)
            context.addIssue({
              code: "custom",
              path,
              message: `Unknown endpoint reference: ${connection.serviceKey}.${connection.endpointKey}`,
            });
          else if (connection.serviceKey === service.key)
            context.addIssue({
              code: "custom",
              path,
              message: "A service cannot call its own endpoint",
            });
        });
      });
    });
  });

export type GraphCodeManifest = z.infer<typeof graphCodeManifestSchema>;
