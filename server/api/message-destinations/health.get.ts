import { messageDestinationHealthResponseSchema } from "#shared/api/message-flows";
import { listBrokerHealthTargets } from "../../repositories/message-destinations";
import { ensureProject } from "../../utils/project";
import {
  checkKafkaBroker,
  checkRabbitMqBroker,
  createCheckMessageDestinationHealthUseCase,
} from "../../use-cases/message-destinations/check-health";

const checkHealth = createCheckMessageDestinationHealthUseCase({
  ensureProject,
  listTargets: listBrokerHealthTargets,
  checkKafka: checkKafkaBroker,
  checkRabbitMq: checkRabbitMqBroker,
});

export default defineEventHandler(async () =>
  messageDestinationHealthResponseSchema.parse(await checkHealth()),
);
