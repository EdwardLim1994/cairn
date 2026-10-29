import { asc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { environmentVariables } from "../../db/schema";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async () => {
  const projectId = await ensureProject();
  return getDb()
    .select()
    .from(environmentVariables)
    .where(eq(environmentVariables.projectId, projectId))
    .orderBy(asc(environmentVariables.name));
});
