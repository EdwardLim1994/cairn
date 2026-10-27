import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { services } from "../../db/schema";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async () => {
  const projectId = await ensureProject();
  const rows = await getDb()
    .select({ id: services.id, framework: services.framework, baseUrl: services.baseUrl })
    .from(services)
    .where(eq(services.projectId, projectId));

  return await Promise.all(
    rows.map(async (service) => {
      const framework = service.framework.toLowerCase();
      const healthPath =
        framework === "spring boot"
          ? "/actuator/health"
          : framework.includes(".net")
            ? "/health"
            : null;
      if (!healthPath) return { id: service.id, online: false };

      try {
        const response = await fetch(new URL(healthPath, service.baseUrl), {
          signal: AbortSignal.timeout(2000),
        });
        return { id: service.id, online: response.ok };
      } catch {
        return { id: service.id, online: false };
      }
    }),
  );
});
