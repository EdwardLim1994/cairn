import type {
  KafkaConnection,
  MessageDestinationHealthResponse,
  RabbitMqConnection,
} from "#shared/api/message-flows";

type HealthTarget = {
  id: string;
  broker: "kafka" | "rabbitmq";
  connection: KafkaConnection | RabbitMqConnection;
  password?: string;
};

export function createCheckMessageDestinationHealthUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  listTargets: (projectId: string) => Promise<HealthTarget[]>;
  checkKafka: (connection: KafkaConnection, password?: string) => Promise<boolean>;
  checkRabbitMq: (connection: RabbitMqConnection, password?: string) => Promise<boolean>;
}) {
  return async (): Promise<MessageDestinationHealthResponse> => {
    const targets = await dependencies.listTargets(await dependencies.ensureProject());
    return Promise.all(
      targets.map(async (target) => ({
        id: target.id,
        online:
          target.broker === "kafka"
            ? await dependencies.checkKafka(target.connection as KafkaConnection, target.password)
            : await dependencies.checkRabbitMq(
                target.connection as RabbitMqConnection,
                target.password,
              ),
      })),
    );
  };
}
