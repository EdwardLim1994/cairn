import { asc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { mockApis } from "../../db/schema";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async () => {
  const projectId = await ensureProject();
  return await getDb()
    .select()
    .from(mockApis)
    .where(eq(mockApis.projectId, projectId))
    .orderBy(asc(mockApis.createdAt));
});
