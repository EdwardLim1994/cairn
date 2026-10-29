import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { environmentVariables } from "../../db/schema";
import { environmentVariableInput } from "../../utils/environment-variables";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async (event) => {
  const input = environmentVariableInput(await readBody(event));
  const projectId = await ensureProject();
  const [existing] = await getDb()
    .select({ id: environmentVariables.id })
    .from(environmentVariables)
    .where(
      and(eq(environmentVariables.projectId, projectId), eq(environmentVariables.name, input.name)),
    );
  if (existing)
    throw createError({
      statusCode: 409,
      statusMessage: `Variable "${input.name}" already exists`,
    });

  const id = randomUUID();
  await getDb()
    .insert(environmentVariables)
    .values({ id, projectId, ...input });
  return { id };
});
