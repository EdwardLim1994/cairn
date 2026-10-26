import { getAppConfig } from "../utils/config";

export default defineNitroPlugin(() => {
  getAppConfig();
});
