import { describe, expect, it, vi } from "vite-plus/test";
import { CanvasConstraintError } from "../../repositories/canvas/errors";
import { createSaveCanvasUseCase } from "./save-canvas";

const validCanvas = {
  viewport: { x: 10, y: 20, zoom: 1.5 },
  mockNode: { x: 30, y: 40 },
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
    expect(dependencies.saveCanvas).toHaveBeenCalledWith("project-1", validCanvas);
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
});
