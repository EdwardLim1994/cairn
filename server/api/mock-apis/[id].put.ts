import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { mockApis, serviceEndpoints } from "../../db/schema";
import { ensureProject } from "../../utils/project";
import { mockApiInput } from "../../utils/mock-api-validation";

export default defineEventHandler(async (event) => {
  const input = mockApiInput(await readBody(event));
  const projectId = await ensureProject();
  const id = getRouterParam(event, "id")!;
  const db = getDb();
  const [[entry], [endpoint]] = await Promise.all([
    db
      .select({ id: mockApis.id })
      .from(mockApis)
      .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId))),
    db
      .select({ id: serviceEndpoints.id })
      .from(serviceEndpoints)
      .where(
        and(
          eq(serviceEndpoints.id, input.targetEndpointId),
          eq(serviceEndpoints.projectId, projectId),
        ),
      ),
  ]);
  if (!entry) throw createError({ statusCode: 404, statusMessage: "Mock API not found" });
  if (!endpoint)
    throw createError({
      statusCode: 400,
      statusMessage: "Selected endpoint is not in this project",
    });
  await db.update(mockApis).set(input).where(eq(mockApis.id, id));
  return { id };
});
