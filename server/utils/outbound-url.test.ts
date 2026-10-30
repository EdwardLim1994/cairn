import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getOutboundUrl } from "./outbound-url";

afterEach(() => vi.unstubAllEnvs());

describe("outbound URL resolution", () => {
  it("joins relative endpoint paths to the service base URL", () => {
    expect(getOutboundUrl("/orders", "http://localhost:8081").toString()).toBe(
      "http://localhost:8081/orders",
    );
  });

  it("rewrites host-local addresses when a container gateway is configured", () => {
    vi.stubEnv("OUTBOUND_HOST_GATEWAY", "host.docker.internal");
    expect(getOutboundUrl("/orders", "http://127.0.0.1:8081").toString()).toBe(
      "http://host.docker.internal:8081/orders",
    );
    expect(getOutboundUrl("/orders", "http://service:8081").hostname).toBe("service");
  });
});
