import { canvasPutRequestSchema, type CanvasPutRequest } from "#shared/api/canvas";
import { CanvasConstraintError } from "../../repositories/canvas/errors";

export function createSaveCanvasUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  saveCanvas: (projectId: string, canvas: CanvasPutRequest) => Promise<void>;
}) {
  return async (input: unknown) => {
    const parsed = canvasPutRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new CanvasConstraintError(parsed.error.issues[0]?.message ?? "Invalid canvas");
    const canvas = parsed.data;
    const edgeKeys = canvas.edges.map(
      ({ sourceServiceId, targetEndpointId }) => `${sourceServiceId}:${targetEndpointId}`,
    );
    if (new Set(edgeKeys).size !== edgeKeys.length)
      throw new CanvasConstraintError("Canvas contains duplicate connections");
    await dependencies.saveCanvas(await dependencies.ensureProject(), canvas);
    return { saved: true as const };
  };
}
