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
    const canvas = {
      ...parsed.data,
      messageDestinations: parsed.data.messageDestinations ?? [],
      messageConnections: parsed.data.messageConnections ?? [],
    };
    const destinationIds = canvas.messageDestinations.map(({ id }) => id);
    const destinationKeys = canvas.messageDestinations.map(({ codeKey }) => codeKey);
    if (new Set(destinationIds).size !== destinationIds.length)
      throw new CanvasConstraintError("Canvas contains duplicate message destinations");
    if (new Set(destinationKeys).size !== destinationKeys.length)
      throw new CanvasConstraintError("Canvas contains duplicate message destination keys");
    const messageConnectionKeys = canvas.messageConnections.map((connection) =>
      connection.type === "publish"
        ? `publish:${connection.endpointId ?? connection.serviceId}:${connection.destinationId}`
        : `subscribe:${connection.destinationId}:${connection.serviceId}`,
    );
    if (new Set(messageConnectionKeys).size !== messageConnectionKeys.length)
      throw new CanvasConstraintError("Canvas contains duplicate message connections");
    const edgeKeys = canvas.edges.map(
      ({ sourceServiceId, sourceEndpointId, targetEndpointId }) =>
        `${sourceEndpointId ?? sourceServiceId}:${targetEndpointId}`,
    );
    if (new Set(edgeKeys).size !== edgeKeys.length)
      throw new CanvasConstraintError("Canvas contains duplicate connections");
    await dependencies.saveCanvas(await dependencies.ensureProject(), canvas);
    return { saved: true as const };
  };
}
