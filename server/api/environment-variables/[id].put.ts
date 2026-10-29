import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../db";
import { environmentVariables } from "../../db/schema";
import { environmentVariableInput } from "../../utils/environment-variables";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async (event) => {
  const input = environmentVariableInput(await readBody(event));
  const projectId = await ensureProject();
  const id = getRouterParam(event, "id")!;
  const db = getDb();
  const [existing] = await db
    .select({ id: environmentVariables.id })
    .from(environmentVariables)
    .where(and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId)));
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: "Environment variable not found" });

  const [duplicate] = await db
    .select({ id: environmentVariables.id })
    .from(environmentVariables)
    .where(
      and(
        eq(environmentVariables.projectId, projectId),
        eq(environmentVariables.name, input.name),
        ne(environmentVariables.id, id),
      ),
    );
  if (duplicate)
    throw createError({
      statusCode: 409,
      statusMessage: `Variable "${input.name}" already exists`,
    });

  await db.update(environmentVariables).set(input).where(eq(environmentVariables.id, id));
  return { id };
});
