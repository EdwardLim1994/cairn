import { eq } from "drizzle-orm";
import { kafkaConnectionSchema, rabbitMqConnectionSchema } from "#shared/api/message-flows";
import { getDb } from "../../db";
import { messageDestinations } from "../../db/schema";
import { getEnvironmentVariableValues } from "../../modules/mock-apis";

/** Reads destination records and resolves their project-scoped broker credentials. */
export class MessageDestinationReader {
  constructor(private readonly db: ReturnType<typeof getDb>) {}

  list(projectId: string) {
    return this.db
      .select()
      .from(messageDestinations)
      .where(eq(messageDestinations.projectId, projectId));
  }

  async listHealthTargets(projectId: string) {
    const [destinations, variableRows] = await Promise.all([
      this.list(projectId),
      getEnvironmentVariableValues(projectId),
    ]);
    const variables = new Map(variableRows.map(({ name, value }) => [name, value]));
    return destinations.map((destination) => ({
      id: destination.id,
      broker: destination.broker,
      connection:
        destination.broker === "kafka"
          ? kafkaConnectionSchema.parse(destination.connection)
          : rabbitMqConnectionSchema.parse(destination.connection),
      password: variables.get(
        (destination.connection as { passwordVariable?: string }).passwordVariable ?? "",
      ),
    }));
  }
}
