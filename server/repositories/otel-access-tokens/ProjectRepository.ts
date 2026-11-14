import { getDb } from "../../db";
import { projects } from "../../db/schema";

/** Initializes the configured project without touching another project's rows. */
export class ProjectRepository {
  constructor(private readonly db: ReturnType<typeof getDb>) {}

  async ensure(projectId: string) {
    await this.db.insert(projects).values({ id: projectId }).onConflictDoNothing();
    return projectId;
  }
}
