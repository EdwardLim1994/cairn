import type { CanvasGetResponse } from "#shared/api/canvas";

export function createGetCanvasUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  getCanvas: (projectId: string) => Promise<CanvasGetResponse>;
}) {
  return async () => dependencies.getCanvas(await dependencies.ensureProject());
}
