// Public message destination operations.
export {
  listMessageDestinations,
  listBrokerHealthTargets,
  MessageDestinationWriter,
} from "../../repositories/message-destinations";
export { createCheckMessageDestinationHealthUseCase } from "../../use-cases/message-destinations/check-health";
export { BrokerHealthService } from "./BrokerHealthService";

import { BrokerHealthService } from "./BrokerHealthService";
const brokerHealth = new BrokerHealthService();
export const checkKafkaBroker = brokerHealth.checkKafka.bind(brokerHealth);
export const checkRabbitMqBroker = brokerHealth.checkRabbitMq.bind(brokerHealth);
