import { canvasPutRequestSchema, type CanvasPutRequest } from "#shared/api/canvas";
import { CanvasConstraintError } from "../../modules/graph-canvas";

export function createSaveCanvasUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  saveCanvas: (projectId: string, canvas: CanvasPutRequest) => Promise<void>;
  getCanvas?: (
    projectId: string,
  ) => Promise<{ edges: unknown[]; messageDestinations: unknown[]; messageConnections: unknown[] }>;
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
    if (new Set(destinationIds).size !== destinationIds.length)
      throw new CanvasConstraintError("Canvas contains duplicate message destinations");
    const messageConnectionKeys = canvas.messageConnections.map((connection) =>
      connection.type === "publish"
        ? `publish:${connection.subscriptionId ?? connection.endpointId ?? connection.serviceId}:${connection.destinationId}`
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
    const projectId = await dependencies.ensureProject();
    if (
      dependencies.getCanvas &&
      !canvas.edges.length &&
      !canvas.messageDestinations.length &&
      !canvas.messageConnections.length
    ) {
      const current = await dependencies.getCanvas(projectId);
      if (
        current.edges.length +
          current.messageDestinations.length +
          current.messageConnections.length >
        1
      )
        throw new CanvasConstraintError("Canvas has changed; reload before saving");
    }
    await dependencies.saveCanvas(projectId, canvas);
    return { saved: true as const };
  };
}
