import { describe, expect, it, vi } from "vite-plus/test";
import { CanvasConstraintError } from "../../../repositories/canvas/errors";
import { createSaveCanvasUseCase } from "../../../use-cases/canvas/save-canvas";

const validCanvas = {
  nodesLocked: true,
  viewport: { x: 10, y: 20, zoom: 1.5 },
  services: [{ id: "service-1", x: 50, y: 60 }],
  edges: [{ sourceServiceId: "service-1", targetEndpointId: "endpoint-2" }],
};

describe("save canvas use case", () => {
  it("resolves the project and delegates the validated canvas to its repository", async () => {
    const dependencies = {
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      saveCanvas: vi.fn().mockResolvedValue(undefined),
    };

    await expect(createSaveCanvasUseCase(dependencies)(validCanvas)).resolves.toEqual({
      saved: true,
    });
    expect(dependencies.ensureProject).toHaveBeenCalledOnce();
    expect(dependencies.saveCanvas).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining(validCanvas),
    );
  });

  it("rejects invalid contracts before calling the repository", async () => {
    const dependencies = {
      ensureProject: vi.fn(),
      saveCanvas: vi.fn(),
    };

    await expect(createSaveCanvasUseCase(dependencies)({})).rejects.toBeInstanceOf(
      CanvasConstraintError,
    );
    expect(dependencies.ensureProject).not.toHaveBeenCalled();
    expect(dependencies.saveCanvas).not.toHaveBeenCalled();
  });

  it("rejects duplicate connections", async () => {
    const dependencies = {
      ensureProject: vi.fn(),
      saveCanvas: vi.fn(),
    };
    const duplicateEdges = {
      ...validCanvas,
      edges: [...validCanvas.edges, ...validCanvas.edges],
    };

    await expect(createSaveCanvasUseCase(dependencies)(duplicateEdges)).rejects.toThrow(
      "Canvas contains duplicate connections",
    );
    expect(dependencies.saveCanvas).not.toHaveBeenCalled();
  });

  it("allows different source endpoints to call same target endpoint", async () => {
    const dependencies = {
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      saveCanvas: vi.fn().mockResolvedValue(undefined),
    };
    const canvas = {
      ...validCanvas,
      edges: [
        {
          sourceServiceId: "service-1",
          sourceEndpointId: "source-1",
          targetEndpointId: "endpoint-2",
        },
        {
          sourceServiceId: "service-1",
          sourceEndpointId: "source-2",
          targetEndpointId: "endpoint-2",
        },
      ],
    };

    await expect(createSaveCanvasUseCase(dependencies)(canvas)).resolves.toEqual({ saved: true });
    expect(dependencies.saveCanvas).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining(canvas),
    );
  });

  it("accepts typed Kafka and RabbitMQ message connections", async () => {
    const dependencies = {
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      saveCanvas: vi.fn().mockResolvedValue(undefined),
    };
    const canvas = {
      ...validCanvas,
      messageDestinations: [
        {
          id: "kafka-1",
          broker: "kafka",
          name: "orders",
          connection: { brokers: "localhost:9092" },
          x: 0,
          y: 0,
        },
        {
          id: "rabbit-1",
          broker: "rabbitmq",
          name: "events",
          connection: { host: "localhost" },
          x: 300,
          y: 0,
        },
      ],
      messageConnections: [
        { type: "publish", destinationId: "kafka-1", endpointId: "endpoint-1" },
        {
          type: "subscribe",
          destinationId: "kafka-1",
          serviceId: "service-2",
          consumerGroup: "orders-v1",
        },
        {
          type: "publish",
          destinationId: "rabbit-1",
          endpointId: "endpoint-2",
          routingKey: "orders.created",
        },
        {
          type: "subscribe",
          destinationId: "rabbit-1",
          serviceId: "service-3",
          bindingKey: "orders.*",
        },
      ],
    };

    await expect(createSaveCanvasUseCase(dependencies)(canvas)).resolves.toEqual({ saved: true });
  });

  it("rejects invalid broker-specific connection fields", async () => {
    const dependencies = { ensureProject: vi.fn(), saveCanvas: vi.fn() };
    const canvas = {
      ...validCanvas,
      messageDestinations: [
        {
          id: "kafka-1",
          broker: "kafka",
          name: "orders",
          connection: { brokers: "localhost:9092" },
          x: 0,
          y: 0,
        },
      ],
      messageConnections: [
        {
          type: "publish",
          destinationId: "kafka-1",
          endpointId: "endpoint-1",
          routingKey: "orders.created",
        },
      ],
    };

    await expect(createSaveCanvasUseCase(dependencies)(canvas)).rejects.toBeInstanceOf(
      CanvasConstraintError,
    );
    expect(dependencies.saveCanvas).not.toHaveBeenCalled();
  });
});
