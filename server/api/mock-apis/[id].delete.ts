import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { mockApis } from "../../db/schema";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async (event) => {
  const projectId = await ensureProject();
  const id = getRouterParam(event, "id")!;
  const result = await getDb()
    .delete(mockApis)
    .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
  if (!result[0]?.affectedRows)
    throw createError({ statusCode: 404, statusMessage: "Mock API not found" });
  return { id };
});
