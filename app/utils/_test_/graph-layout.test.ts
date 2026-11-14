import { describe, expect, it } from "vite-plus/test";
import { arrangeGraph } from "../graph-layout";

const services = [
  { id: "caller", name: "Caller", endpoint: "caller-endpoint" },
  { id: "target", name: "Target", endpoint: "target-endpoint" },
  { id: "alone", name: "Alone", endpoint: "alone-endpoint" },
].map(({ id, name, endpoint }) => ({
  id,
  name,
  endpoints: [{ id: endpoint }],
}));

describe("arrangeGraph", () => {
  it("layers callers before targets and separates disconnected services", () => {
    const positions = arrangeGraph(
      services as never,
      [{ sourceServiceId: "caller", targetEndpointId: "target-endpoint" }],
      [{ id: "mock-1", targetEndpointId: "target-endpoint" }] as never,
    );
    expect(positions.get("caller")?.x).toBeLessThan(positions.get("target")!.x);
    expect(new Set([positions.get("alone")?.y, positions.get("caller")?.y]).size).toBe(2);
    const trigger = positions.get("mock-api-mock-1");
    expect(trigger).toMatchObject({ x: 394, y: 49 });
    expect(trigger!.x).toBeGreaterThan(positions.get("caller")!.x + 288);
    expect(positions.get("target")!.x - (trigger!.x + 254)).toBe(72);
  });

  it("keeps cycles in one layer and stacks target mock APIs with expanded-height spacing", () => {
    const cyclicServices = services.slice(0, 2).map((service) => ({
      ...service,
      endpoints: [
        ...service.endpoints,
        ...Array.from({ length: 4 }, (_, index) => ({ id: `${service.id}-${index}` })),
      ],
    }));
    const positions = arrangeGraph(
      cyclicServices as never,
      [
        { sourceServiceId: "caller", targetEndpointId: "target-endpoint" },
        { sourceServiceId: "target", targetEndpointId: "caller-endpoint" },
      ],
      [
        { id: "mock-b", targetEndpointId: "target-endpoint" },
        { id: "mock-a", targetEndpointId: "target-endpoint" },
      ] as never,
    );
    expect(positions.get("caller")?.x).toBe(positions.get("target")?.x);
    expect(positions.get("mock-api-mock-a")?.y).toBeLessThan(positions.get("mock-api-mock-b")!.y);
    expect(positions.get("target")!.y).toBeGreaterThan(positions.get("caller")!.y + 365);
  });

  it("places all message queue nodes in their own column", () => {
    const positions = arrangeGraph(
      services as never,
      [],
      [],
      [
        { id: "orders", name: "Orders", queueId: "orders" },
        { id: "payments", name: "Payments", queueId: "payments" },
      ],
      [
        { type: "publish", destinationId: "orders", endpointId: "caller-endpoint" },
        { type: "subscribe", destinationId: "payments", serviceId: "target" },
      ],
    );
    const orders = positions.get("message-queue:orders")!;
    const payments = positions.get("message-queue:payments")!;
    expect(orders.x).toBe(payments.x);
    expect(orders.x).toBeGreaterThan(positions.get("caller")!.x);
    expect(orders.x).toBeGreaterThan(positions.get("target")!.x);
    expect(orders.y).not.toBe(payments.y);
  });

  it("spaces individual destination nodes during auto arrange", () => {
    const positions = arrangeGraph(
      [...services, { id: "zulu", name: "Zulu", endpoints: [{ id: "zulu-endpoint" }] }] as never,
      [],
      [],
      [
        { id: "orders", name: "Orders", queueId: "shared" },
        { id: "payments", name: "Payments", queueId: "shared" },
        { id: "shipments", name: "Shipments", queueId: "shared" },
      ],
    );
    const orders = positions.get("message-queue:orders")!;
    const payments = positions.get("message-queue:payments")!;
    const shipments = positions.get("message-queue:shipments")!;
    expect(payments.y - orders.y).toBe(193);
    expect(shipments.y - payments.y).toBe(193);
  });
});
