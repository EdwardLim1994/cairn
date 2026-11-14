import { messageDestinationHealthResponseSchema } from "#shared/api/message-flows";
import { ensureProject } from "../../utils/project";
import {
  checkKafkaBroker,
  checkRabbitMqBroker,
  createCheckMessageDestinationHealthUseCase,
  listBrokerHealthTargets,
} from "../../modules/message-destinations";

const checkHealth = createCheckMessageDestinationHealthUseCase({
  ensureProject,
  listTargets: listBrokerHealthTargets,
  checkKafka: checkKafkaBroker,
  checkRabbitMq: checkRabbitMqBroker,
});

export default defineEventHandler(async () =>
  messageDestinationHealthResponseSchema.parse(await checkHealth()),
);
