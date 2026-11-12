import { describe, expect, it } from "vite-plus/test";
import { createOtelAccessTokenUseCase, createListOtelAccessTokensUseCase } from "./manage";
import { digestAccessToken, generateAccessToken, isAccessTokenValid } from "./token";
import { otelAccessTokenCreateRequestSchema } from "#shared/api/otel-access-tokens";

describe("OpenTelemetry access tokens", () => {
  it("generates unique URL-safe secrets and irreversible digests", () => {
    const first = generateAccessToken();
    const second = generateAccessToken();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.digest).toBe(digestAccessToken(first.token));
    expect(first.digest).not.toBe(first.token);
  });

  it("uses strict expiry boundary", () => {
    const boundary = new Date("2030-01-01T00:00:00.000Z");
    expect(isAccessTokenValid(boundary, new Date(boundary.getTime() - 1))).toBe(true);
    expect(isAccessTokenValid(boundary, boundary)).toBe(false);
  });

  it("rejects blank names and non-future expiry dates", () => {
    expect(
      otelAccessTokenCreateRequestSchema.safeParse({
        name: "  ",
        expiresAt: "2030-01-01T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      otelAccessTokenCreateRequestSchema.safeParse({
        name: "collector",
        expiresAt: "2000-01-01T00:00:00Z",
      }).success,
    ).toBe(false);
  });

  it("stores only digest and lists metadata for multiple valid tokens", async () => {
    const stored: Array<{
      id: string;
      projectId: string;
      name: string;
      digest: string;
      expiresAt: Date | null;
    }> = [];
    const create = createOtelAccessTokenUseCase({
      ensureProject: async () => "project",
      create: async (entry) => {
        stored.push(entry);
      },
    });
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const first = await create({ name: "first", expiresAt });
    const second = await create({ name: "second", expiresAt });
    expect(stored).toHaveLength(2);
    expect(stored[0]!.digest).toBe(digestAccessToken(first.token));
    expect(stored[1]!.digest).toBe(digestAccessToken(second.token));
    const list = createListOtelAccessTokensUseCase({
      ensureProject: async () => "project",
      list: async () =>
        stored.map(({ id, name, expiresAt }) => ({ id, name, expiresAt, createdAt: new Date() })),
    });
    const result = await list();
    expect(result).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain(first.token);
    expect(JSON.stringify(result)).not.toContain("digest");
  });
});
