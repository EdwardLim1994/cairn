/** Route saved localhost service URLs through a host-published reverse proxy in Docker. */
export function getOutboundUrl(path: string, baseUrl: string): URL {
  const url = /^https?:\/\//i.test(path)
    ? new URL(path)
    : new URL(path, `${baseUrl.replace(/\/$/, "")}/`);
  const gateway = process.env.OUTBOUND_HOST_GATEWAY?.trim();

  if (gateway && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    url.hostname = gateway;
  }

  return url;
}

export function getOutboundGrpcTarget(target: string): string {
  const gateway = process.env.OUTBOUND_HOST_GATEWAY?.trim();
  if (!gateway) return target;
  const match = /^(?:localhost|127\.0\.0\.1|\[?::1\]?):(\d+)$/.exec(target);
  return match ? `${gateway}:${match[1]}` : target;
}
