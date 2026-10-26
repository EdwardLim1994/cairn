import { randomUUID } from "node:crypto";
import { getDb } from "../../db";
import { serviceEndpoints, services } from "../../db/schema";
import { finiteNumber, record, serviceInput } from "../../utils/graph-validation";
import { ensureProject } from "../../utils/project";

export default defineEventHandler(async (event) => {
  const body = record(await readBody(event), "Service");
  const input = serviceInput(body);
  const projectId = await ensureProject();
  const serviceId = randomUUID();
  await getDb().transaction(async (tx) => {
    await tx.insert(services).values({
      id: serviceId,
      projectId,
      name: input.name,
      framework: input.framework,
      baseUrl: input.baseUrl,
      active: input.active,
      positionX: finiteNumber(body.positionX, "Service x", 0),
      positionY: finiteNumber(body.positionY, "Service y", 0),
    });
    if (input.endpoints.length)
      await tx.insert(serviceEndpoints).values(
        input.endpoints.map(({ id: _id, ...endpoint }) => ({
          ...endpoint,
          id: randomUUID(),
          projectId,
          serviceId,
        })),
      );
  });
  return { id: serviceId };
});
