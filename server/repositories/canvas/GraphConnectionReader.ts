import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { messageConnections } from "../../db/schema";

/** Reads persisted graph connections for run-flow correlation. */
export class GraphConnectionReader {
  constructor(private readonly db: ReturnType<typeof getDb>) {}

  listMessageConnections(projectId: string) {
    return this.db
      .select()
      .from(messageConnections)
      .where(eq(messageConnections.projectId, projectId));
  }
}
