import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { kafkaConnectionSchema, rabbitMqConnectionSchema } from "#shared/api/message-flows";
import { environmentVariables, messageDestinations } from "../../db/schema";

export async function listBrokerHealthTargets(projectId: string, db = getDb()) {
  const [destinations, variableRows] = await Promise.all([
    db.select().from(messageDestinations).where(eq(messageDestinations.projectId, projectId)),
    db
      .select({ name: environmentVariables.name, value: environmentVariables.value })
      .from(environmentVariables)
      .where(eq(environmentVariables.projectId, projectId)),
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
