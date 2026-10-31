import {
  mockApiSettingsSaveRequestSchema,
  mockApiSettingsSaveResponseSchema,
} from "#shared/api/mock-apis";
import { saveMockApiSettings } from "../repositories/mock-api-settings";
import { ensureProject } from "../utils/project";

export default defineEventHandler(async (event) => {
  const input = mockApiSettingsSaveRequestSchema.parse(await readBody(event));
  try {
    return mockApiSettingsSaveResponseSchema.parse(
      await saveMockApiSettings(await ensureProject(), input),
    );
  } catch (cause) {
    throw createError({
      statusCode:
        cause instanceof Error &&
        /another session|not in this project|unavailable/.test(cause.message)
          ? 409
          : 400,
      statusMessage: cause instanceof Error ? cause.message : "Could not save Mock APIs settings",
      cause,
    });
  }
});
