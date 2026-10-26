import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { services } from "../../db/schema";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async (event) => {
  const projectId = await ensureProject();
  const id = getRouterParam(event, "id")!;
  const result = await getDb()
    .delete(services)
    .where(and(eq(services.id, id), eq(services.projectId, projectId)));
  if (!result[0]?.affectedRows)
    throw createError({ statusCode: 404, statusMessage: "Service not found" });
  return { id };
});
