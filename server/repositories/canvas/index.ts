import type { CanvasGetResponse, CanvasPutRequest } from "#shared/api/canvas";
import { getDb } from "../../db";
import { CanvasRepository } from "./CanvasRepository";
import { GraphConnectionReader } from "./GraphConnectionReader";

export { CanvasRepository } from "./CanvasRepository";
export { GraphConnectionReader } from "./GraphConnectionReader";
type Database = ReturnType<typeof getDb>;
export const getCanvas = (projectId: string, db: Database = getDb()): Promise<CanvasGetResponse> =>
  new CanvasRepository(db).getCanvas(projectId);
export const saveCanvas = (
  projectId: string,
  canvas: CanvasPutRequest,
  db: Database = getDb(),
): Promise<void> => new CanvasRepository(db).saveCanvas(projectId, canvas);
export const listMessageConnections = (projectId: string, db: Database = getDb()) =>
  new GraphConnectionReader(db).listMessageConnections(projectId);
