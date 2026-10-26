import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { runs } from "../../db/schema";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async (event) => {
  const projectId = await ensureProject();
  const id = getRouterParam(event, "id")!;
  const [run] = await getDb()
    .select()
    .from(runs)
    .where(and(eq(runs.id, id), eq(runs.projectId, projectId)));
  if (!run) throw createError({ statusCode: 404, statusMessage: "Run not found" });
  return run;
});
