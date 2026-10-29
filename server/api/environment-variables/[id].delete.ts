import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { environmentVariables } from "../../db/schema";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async (event) => {
  const projectId = await ensureProject();
  const id = getRouterParam(event, "id")!;
  await getDb()
    .delete(environmentVariables)
    .where(and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId)));
  return { id };
});
