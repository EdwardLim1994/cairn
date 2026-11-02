import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getOAuthAccessToken, type OAuthClientCredentials } from "./oauth-client";

const config: OAuthClientCredentials = {
  tokenUrl: "https://auth.example.com/token",
  clientId: "my client",
  clientSecret: "s:cret",
  scope: "read:orders",
};
const variables = new Map([
  ["CLIENT", "resolved-client"],
  ["SECRET", "resolved-secret"],
]);

function requestUrl(input: RequestInfo | URL): string {
  return input instanceof URL ? input.href : typeof input === "string" ? input : input.url;
}

function options(
  projectId: string,
  templateId: string,
  fetch: typeof globalThis.fetch,
  overrides: Partial<{
    config: OAuthClientCredentials;
    timeoutMs: number;
  }> = {},
) {
  return {
    projectId,
    templateId,
    config: overrides.config ?? config,
    variables,
    fetch,
    timeoutMs: overrides.timeoutMs ?? 1000,
  };
}

function tokenResponse(token = "access-token", expires_in = 3600) {
  return new Response(JSON.stringify({ access_token: token, expires_in }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => vi.useRealTimers());

describe("OAuth Client Credentials", () => {
  it("sends form credentials with client_secret_basic and optional scope", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(tokenResponse());
    await expect(getOAuthAccessToken(options("oauth-request", "template", fetch))).resolves.toBe(
      "access-token",
    );
    const [url, init] = fetch.mock.calls[0]!;
    expect(requestUrl(url)).toBe(config.tokenUrl);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from("my+client:s%3Acret").toString("base64")}`,
    });
    expect(init?.body).toBeInstanceOf(URLSearchParams);
    expect((init?.body as URLSearchParams | undefined)?.toString()).toBe(
      "grant_type=client_credentials&scope=read%3Aorders",
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("resolves environment variables before requesting a token", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(tokenResponse());
    const tokenConfig = {
      tokenUrl: "https://auth.example.com/token",
      clientId: "{{CLIENT}}",
      clientSecret: "{{SECRET}}",
    };
    await getOAuthAccessToken(options("oauth-vars", "template", fetch, { config: tokenConfig }));
    const init = fetch.mock.calls[0]![1]!;
    expect(init.headers).toMatchObject({
      authorization: `Basic ${Buffer.from("resolved-client:resolved-secret").toString("base64")}`,
    });
  });

  it("uses configured timeout and redacts token endpoint failures", async () => {
    vi.useFakeTimers();
    const timeoutFetch = vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("client secret leaked")));
        }),
    );
    const pending = getOAuthAccessToken(
      options("oauth-timeout", "template", timeoutFetch, { timeoutMs: 25 }),
    );
    const rejected = expect(pending).rejects.toThrow("OAuth token request failed");
    await vi.advanceTimersByTimeAsync(25);
    await rejected;

    const rejectedFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response("private credential response", { status: 401 }));
    await expect(
      getOAuthAccessToken(options("oauth-rejected", "template", rejectedFetch)),
    ).rejects.toThrow("OAuth token request failed");
  });

  it("reuses tokens, refreshes before expiry, and invalidates changed configuration", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(tokenResponse("first", 10))
      .mockResolvedValueOnce(tokenResponse("second", 10))
      .mockResolvedValueOnce(tokenResponse("changed-config", 10));
    const initial = options("oauth-cache", "template", fetch, {
      config: { ...config, scope: undefined },
    });
    await expect(getOAuthAccessToken(initial)).resolves.toBe("first");
    await expect(getOAuthAccessToken(initial)).resolves.toBe("first");
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(9100);
    await expect(getOAuthAccessToken(initial)).resolves.toBe("second");
    const changed = options("oauth-cache", "template", fetch, {
      config: { ...config, scope: undefined, clientSecret: "changed" },
    });
    await expect(getOAuthAccessToken(changed)).resolves.toBe("changed-config");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("coalesces concurrent token requests and does not cache responses without expiry", async () => {
    vi.useRealTimers();
    let resolveToken!: (response: Response) => void;
    const deferred = new Promise<Response>((resolve) => (resolveToken = resolve));
    const fetch = vi.fn<typeof globalThis.fetch>().mockReturnValue(deferred);
    const request = options("oauth-concurrent", "template", fetch, {
      config: { ...config, scope: undefined },
    });
    const first = getOAuthAccessToken(request);
    const second = getOAuthAccessToken(request);
    expect(fetch).toHaveBeenCalledOnce();
    resolveToken(tokenResponse("shared", 3600));
    await expect(Promise.all([first, second])).resolves.toEqual(["shared", "shared"]);

    const noExpiryFetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ access_token: "uncached" }), { status: 200 })),
    );
    const noExpiry = options("oauth-no-expiry", "template", noExpiryFetch, {
      config: { ...config, scope: undefined },
    });
    await getOAuthAccessToken(noExpiry);
    await getOAuthAccessToken(noExpiry);
    expect(noExpiryFetch).toHaveBeenCalledTimes(2);
  });
});
