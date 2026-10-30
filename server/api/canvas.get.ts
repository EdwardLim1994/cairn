import { ensureProject } from "../utils/project";
import { getCanvas } from "../repositories/canvas";
import { createGetCanvasUseCase } from "../use-cases/canvas/get-canvas";

const getCanvasUseCase = createGetCanvasUseCase({ ensureProject, getCanvas });

export default defineEventHandler(async () => {
  try {
    return await getCanvasUseCase();
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Project canvas could not be initialized",
      cause: error,
    });
  }
});
