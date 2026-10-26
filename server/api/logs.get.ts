import { and, desc, eq, like } from "drizzle-orm";
import { getDb } from "../db";
import { logs } from "../db/schema";
import { ensureProject } from "../utils/project";

export default defineEventHandler(async (event) => {
  const projectId = await ensureProject();
  const query = getQuery(event);
  const conditions = [eq(logs.projectId, projectId)];
  if (typeof query.service === "string" && query.service.trim())
    conditions.push(eq(logs.serviceName, query.service.trim()));
  if (typeof query.severity === "string" && query.severity.trim())
    conditions.push(eq(logs.severity, query.severity.trim().toUpperCase()));
  if (typeof query.search === "string" && query.search.trim()) {
    const escaped = query.search.trim().replace(/[\\%_]/g, "\\$&");
    conditions.push(like(logs.message, `%${escaped}%`));
  }
  return await getDb()
    .select()
    .from(logs)
    .where(and(...conditions))
    .orderBy(desc(logs.timestamp), desc(logs.id))
    .limit(500);
});
