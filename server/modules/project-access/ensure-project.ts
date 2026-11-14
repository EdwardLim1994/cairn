import { getAppConfig } from "../../utils/config";
import { ensureProjectRow } from "../../repositories/otel-access-tokens";

export async function ensureProject() {
  return ensureProjectRow(getAppConfig().projectId);
}
