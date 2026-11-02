import { createHash, randomBytes, randomUUID } from "node:crypto";

export function generateAccessToken() {
  const token = randomBytes(32).toString("base64url");
  return { id: randomUUID(), token, digest: digestAccessToken(token) };
}

export function digestAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isAccessTokenValid(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() > now.getTime();
}
