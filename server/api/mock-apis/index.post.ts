import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { mockApis, serviceEndpoints } from "../../db/schema";
import { ensureProject } from "../../utils/project";
import { mockApiInput } from "../../utils/mock-api-validation";

export default defineEventHandler(async (event) => {
  const input = mockApiInput(await readBody(event));
  const projectId = await ensureProject();
  const [endpoint] = await getDb()
    .select({ id: serviceEndpoints.id })
    .from(serviceEndpoints)
    .where(
      and(
        eq(serviceEndpoints.id, input.targetEndpointId),
        eq(serviceEndpoints.projectId, projectId),
      ),
    );
  if (!endpoint)
    throw createError({
      statusCode: 400,
      statusMessage: "Selected endpoint is not in this project",
    });
  const id = randomUUID();
  await getDb()
    .insert(mockApis)
    .values({ id, projectId, ...input });
  return { id };
});
