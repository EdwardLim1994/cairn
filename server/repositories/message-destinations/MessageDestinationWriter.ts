import { and, eq, inArray } from "drizzle-orm";
import type { CanvasPutRequest } from "#shared/api/canvas";
import type { SqliteTransaction } from "../../db";
import { messageDestinations } from "../../db/schema";

/** Writes only message destination rows in the caller's canvas transaction. */
export class MessageDestinationWriter {
  constructor(private readonly db: SqliteTransaction) {}

  async findExistingIds(ids: string[]) {
    if (!ids.length) return [];
    return this.db
      .select({ id: messageDestinations.id, projectId: messageDestinations.projectId })
      .from(messageDestinations)
      .where(inArray(messageDestinations.id, ids));
  }

  async listIds(projectId: string) {
    return this.db
      .select({ id: messageDestinations.id })
      .from(messageDestinations)
      .where(eq(messageDestinations.projectId, projectId));
  }

  async deleteIds(projectId: string, ids: string[]) {
    if (!ids.length) return;
    await this.db
      .delete(messageDestinations)
      .where(
        and(eq(messageDestinations.projectId, projectId), inArray(messageDestinations.id, ids)),
      );
  }

  async upsert(
    projectId: string,
    destinations: NonNullable<CanvasPutRequest["messageDestinations"]>,
    existingIds: Set<string>,
  ) {
    for (const destination of destinations) {
      const values = {
        projectId,
        queueId: destination.queueId ?? "legacy-queue",
        queueName: destination.queueName ?? "Message Queue",
        broker: destination.broker,
        name: destination.name,
        connection: destination.connection as Record<string, string | boolean | undefined>,
      };
      if (existingIds.has(destination.id))
        await this.db
          .update(messageDestinations)
          .set(values)
          .where(
            and(
              eq(messageDestinations.id, destination.id),
              eq(messageDestinations.projectId, projectId),
            ),
          );
      else await this.db.insert(messageDestinations).values({ id: destination.id, ...values });
    }
  }
}
