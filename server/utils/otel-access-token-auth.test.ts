import { createError } from "h3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { hasValidOtelAccessToken } from "../repositories/otel-access-tokens";
import { requireOtelAccessToken } from "./otel-access-token-auth";

vi.mock("../repositories/otel-access-tokens", () => ({
  hasValidOtelAccessToken: vi.fn(),
}));

const token = "a".repeat(43);

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://db/cairn");
  vi.stubEnv("OTEL_COLLECTOR_URL", "http://collector:4318");
  vi.stubEnv("PROJECT_ID", "project-1");
  vi.stubEnv("AUTH_USERNAME", "operator");
  vi.stubEnv("AUTH_PASSWORD", "password");
  vi.stubEnv("AUTH_SESSION_SECRET", "a-session-secret-that-is-at-least-32-characters");
  Object.assign(globalThis, { createError });
  vi.mocked(hasValidOtelAccessToken).mockResolvedValue(true);
});

afterEach(() => vi.unstubAllEnvs());

describe("OTLP bearer authentication", () => {
  it.each(["true", "false"])(
    "requires its bearer token when AUTH_ENABLED is %s",
    async (enabled) => {
      vi.stubEnv("AUTH_ENABLED", enabled);
      const event = { node: { req: { headers: { authorization: `Bearer ${token}` } } } };
      await expect(requireOtelAccessToken(event)).resolves.toBeUndefined();
      await expect(
        requireOtelAccessToken({ node: { req: { headers: {} } } }),
      ).rejects.toMatchObject({ statusCode: 401 });
    },
  );
});
