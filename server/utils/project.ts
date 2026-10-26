import { projects } from "../db/schema";
import { getAppConfig } from "./config";
import { getDb } from "../db";

export async function ensureProject() {
  const projectId = getAppConfig().projectId;
  await getDb()
    .insert(projects)
    .values({ id: projectId })
    .onDuplicateKeyUpdate({ set: { id: projectId } });
  return projectId;
}
