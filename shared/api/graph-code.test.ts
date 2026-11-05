import { describe, expect, it } from "vite-plus/test";
import { graphCodeManifestSchema } from "./graph-code";

const validManifest = {
  version: 1,
  services: [
    {
      key: "orders",
      name: "Orders",
      apiType: "REST",
      framework: "Spring Boot",
      baseUrl: "http://localhost:8081",
      endpoints: [
        {
          key: "list-orders",
          name: "List orders",
          method: "GET",
          url: "/orders",
          outboundConnections: [],
        },
      ],
    },
  ],
};
const validEndpoint = validManifest.services[0]!.endpoints[0]!;

describe("service graph code schema", () => {
  it("accepts valid graph manifests", () => {
    expect(graphCodeManifestSchema.safeParse(validManifest).success).toBe(true);
  });

  it("accepts one POST endpoint on a GraphQL service and rejects other shapes", () => {
    const service = {
      ...validManifest.services[0],
      apiType: "GRAPHQL",
      endpoints: [{ ...validEndpoint, method: "POST", url: "/graphql" }],
    };
    expect(graphCodeManifestSchema.safeParse({ version: 1, services: [service] }).success).toBe(
      true,
    );
    expect(
      graphCodeManifestSchema.safeParse({
        version: 1,
        services: [{ ...service, endpoints: [] }],
      }).success,
    ).toBe(false);
    expect(
      graphCodeManifestSchema.safeParse({
        version: 1,
        services: [{ ...service, endpoints: [{ ...service.endpoints[0], method: "GET" }] }],
      }).success,
    ).toBe(false);
  });

  it("resolves references to services declared later in the document", () => {
    const manifest = {
      version: 1,
      services: [
        {
          ...validManifest.services[0],
          endpoints: [
            {
              ...validEndpoint,
              outboundConnections: [{ serviceKey: "target", endpointKey: "read" }],
            },
          ],
        },
        {
          ...validManifest.services[0],
          key: "target",
          endpoints: [{ ...validEndpoint, key: "read", outboundConnections: [] }],
        },
      ],
    };
    expect(graphCodeManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it("reports unsupported values and duplicate service and endpoint keys with paths", () => {
    const result = graphCodeManifestSchema.safeParse({
      ...validManifest,
      services: [
        {
          ...validManifest.services[0],
          framework: "Spring Boot",
          endpoints: [validEndpoint, validEndpoint],
        },
        validManifest.services[0],
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path)).toContainEqual(["services", 1, "key"]);
    expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
      "services",
      0,
      "endpoints",
      1,
      "key",
    ]);
  });

  it("reports unsupported enum values with field paths", () => {
    const result = graphCodeManifestSchema.safeParse({
      ...validManifest,
      services: [{ ...validManifest.services[0], framework: "Unsupported" }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
      "services",
      0,
      "framework",
    ]);
  });

  it("rejects duplicate connections and missing references", () => {
    const result = graphCodeManifestSchema.safeParse({
      ...validManifest,
      services: [
        {
          ...validManifest.services[0],
          endpoints: [
            {
              ...validEndpoint,
              outboundConnections: [
                { serviceKey: "missing", endpointKey: "target" },
                { serviceKey: "missing", endpointKey: "target" },
              ],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((issue) => issue.path);
    expect(paths).toContainEqual(["services", 0, "endpoints", 0, "outboundConnections", 0]);
    expect(paths).toContainEqual(["services", 0, "endpoints", 0, "outboundConnections", 1]);
  });
});
