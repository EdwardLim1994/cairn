import { ensureProject } from "../utils/project";
import { getCanvas, saveCanvas, CanvasConstraintError } from "../modules/graph-canvas";
import { createSaveCanvasUseCase } from "../use-cases/canvas/save-canvas";

const saveCanvasUseCase = createSaveCanvasUseCase({ ensureProject, getCanvas, saveCanvas });

export default defineEventHandler(async (event) => {
  try {
    return await saveCanvasUseCase(await readBody(event));
  } catch (error) {
    if (error instanceof CanvasConstraintError)
      throw createError({ statusCode: 400, statusMessage: error.message, cause: error });
    throw error;
  }
});
