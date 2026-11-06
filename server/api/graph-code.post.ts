import { graphCodeManifestSchema } from "#shared/api/graph-code";
import { applyGraphCode, GraphCodeConstraintError } from "../repositories/graph-code";
import { ensureProject } from "../utils/project";

export default defineEventHandler(async (event) => {
  const parsed = graphCodeManifestSchema.safeParse(await readBody(event));
  if (!parsed.success)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid service graph code",
      data: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  try {
    await applyGraphCode(await ensureProject(), parsed.data);
  } catch (error) {
    if (error instanceof GraphCodeConstraintError)
      throw createError({ statusCode: 400, statusMessage: error.message, cause: error });
    throw error;
  }
  return { applied: true };
});
