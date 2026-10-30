import { describe, expect, it, vi } from "vite-plus/test";
import { createGetCanvasUseCase } from "./get-canvas";

describe("get canvas use case dependencies", () => {
  it("uses the injected canvas repository", async () => {
    const canvas = {
      viewport: { x: 0, y: 0, zoom: 1 },
      mockNode: { x: 120, y: 120 },
      services: [],
      edges: [],
      mockApis: [],
    };
    const repository = {
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      getCanvas: vi.fn().mockResolvedValue(canvas),
    };

    const result = await createGetCanvasUseCase(repository)();

    expect(repository.ensureProject).toHaveBeenCalledOnce();
    expect(repository.getCanvas).toHaveBeenCalledWith("project-1");
    expect(result).toEqual(canvas);
  });
});
