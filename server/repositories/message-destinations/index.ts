import { getDb } from "../../db";
import { MessageDestinationReader } from "./MessageDestinationReader";

export { MessageDestinationReader } from "./MessageDestinationReader";
export { MessageDestinationWriter } from "./MessageDestinationWriter";

export const listMessageDestinations = (projectId: string, db = getDb()) =>
  new MessageDestinationReader(db).list(projectId);
export const listBrokerHealthTargets = (projectId: string, db = getDb()) =>
  new MessageDestinationReader(db).listHealthTargets(projectId);
