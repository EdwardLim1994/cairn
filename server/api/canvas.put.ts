import { ensureProject } from "../utils/project";
import { saveCanvas } from "../repositories/canvas";
import { CanvasConstraintError } from "../repositories/canvas/errors";
import { createSaveCanvasUseCase } from "../use-cases/canvas/save-canvas";

const saveCanvasUseCase = createSaveCanvasUseCase({ ensureProject, saveCanvas });

export default defineEventHandler(async (event) => {
  try {
    return await saveCanvasUseCase(await readBody(event));
  } catch (error) {
    if (error instanceof CanvasConstraintError)
      throw createError({ statusCode: 400, statusMessage: error.message, cause: error });
    throw error;
  }
});
