import type { CanvasGetResponse, CanvasPutRequest } from "#shared/api/canvas";
import { getDb } from "../../db";
import { CanvasRepository } from "./CanvasRepository";

export { CanvasRepository } from "./CanvasRepository";
type Database = ReturnType<typeof getDb>;
export const getCanvas = (projectId: string, db: Database = getDb()): Promise<CanvasGetResponse> =>
  new CanvasRepository(db).getCanvas(projectId);
export const saveCanvas = (
  projectId: string,
  canvas: CanvasPutRequest,
  db: Database = getDb(),
): Promise<void> => new CanvasRepository(db).saveCanvas(projectId, canvas);
