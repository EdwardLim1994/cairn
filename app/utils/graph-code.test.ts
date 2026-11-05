import { describe, expect, it } from "vite-plus/test";
import { serializeGraphCode } from "./graph-code";

describe("serializeGraphCode", () => {
  it("starts empty when graph has no services", () => {
    expect(serializeGraphCode([], [])).toBe("");
  });

  it("serializes keyed endpoint calls without database or canvas state", () => {
    const services = [
      {
        id: "service-1",
        codeKey: "orders",
        projectId: "project-1",
        name: "Orders",
        apiType: "REST",
        framework: "Spring Boot",
        baseUrl: "http://orders",
        healthCheckUrl: "/ready",
        healthCheckHeaderTemplateId: "template-id",
        healthCheckCustomHeaders: [{ name: "X-Key", value: "secret" }],
        active: false,
        positionX: 10,
        positionY: 20,
        createdAt: "2026-01-01T00:00:00.000Z",
        endpoints: [
          {
            id: "endpoint-1",
            codeKey: "create-order",
            projectId: "project-1",
            serviceId: "service-1",
            name: "Create order",
            method: "POST",
            url: "/orders",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      {
        id: "service-2",
        codeKey: "inventory",
        projectId: "project-1",
        name: "Inventory",
        apiType: "REST",
        framework: "Other",
        baseUrl: "http://inventory",
        healthCheckUrl: null,
        healthCheckHeaderTemplateId: null,
        healthCheckCustomHeaders: [],
        active: true,
        positionX: 720,
        positionY: 10,
        createdAt: "2026-01-01T00:00:00.000Z",
        endpoints: [
          {
            id: "endpoint-2",
            codeKey: "reserve",
            projectId: "project-1",
            serviceId: "service-2",
            name: "Reserve",
            method: "POST",
            url: "/reserve",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    ] as never;
    const code = serializeGraphCode(services, [
      {
        id: "edge-id",
        sourceServiceId: "service-1",
        sourceEndpointId: "endpoint-1",
        targetEndpointId: "endpoint-2",
      },
    ]);

    expect(JSON.parse(code)).toEqual({
      version: 1,
      services: [
        {
          key: "orders",
          name: "Orders",
          apiType: "REST",
          framework: "Spring Boot",
          baseUrl: "http://orders",
          healthCheck: { url: "/ready", headers: [{ name: "X-Key", value: "secret" }] },
          endpoints: [
            {
              key: "create-order",
              name: "Create order",
              method: "POST",
              url: "/orders",
              outboundConnections: [{ serviceKey: "inventory", endpointKey: "reserve" }],
            },
          ],
        },
        {
          key: "inventory",
          name: "Inventory",
          apiType: "REST",
          framework: "Other",
          baseUrl: "http://inventory",
          endpoints: [
            {
              key: "reserve",
              name: "Reserve",
              method: "POST",
              url: "/reserve",
              outboundConnections: [],
            },
          ],
        },
      ],
    });
    expect(code).not.toContain("service-1");
    expect(code).not.toContain("endpoint-1");
    expect(code).not.toContain("positionX");
    expect(code).not.toContain("createdAt");
    expect(code).not.toContain("active");
  });
});
