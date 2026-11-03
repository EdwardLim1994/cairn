import { timingSafeEqual, createHash } from "node:crypto";
import {
  clearSession,
  getCookie,
  unsealSession,
  useSession,
  type H3Event,
  type SessionConfig,
} from "h3";
import { getAppConfig } from "./config";

export const authSessionName = "cairn-session";
export const authSessionMaxAge = 60 * 60 * 8;

export function getAuthSessionConfig(): SessionConfig {
  const config = getAppConfig();
  if (!config.authSessionSecret) throw new Error("Authentication session secret is unavailable");
  return {
    name: authSessionName,
    password: config.authSessionSecret,
    maxAge: authSessionMaxAge,
    sessionHeader: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    },
  };
}

function matchesCredential(input: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(input), digest(expected));
}

export function verifyOperatorCredentials(username: string, password: string): boolean {
  const config = getAppConfig();
  if (!config.authEnabled || !config.authUsername || !config.authPassword) return false;
  const usernameMatches = matchesCredential(username, config.authUsername);
  const passwordMatches = matchesCredential(password, config.authPassword);
  return usernameMatches && passwordMatches;
}

export async function hasAuthenticatedSession(event: H3Event): Promise<boolean> {
  const sealed = getCookie(event, authSessionName);
  if (!sealed) return false;
  try {
    const session = await unsealSession(event, getAuthSessionConfig(), sealed);
    return session.data?.authenticated === true;
  } catch {
    return false;
  }
}

export async function startAuthSession(event: H3Event): Promise<void> {
  const session = await useSession(event, getAuthSessionConfig());
  await session.clear();
  await session.update({ authenticated: true });
}

export async function endAuthSession(event: H3Event): Promise<void> {
  await clearSession(event, getAuthSessionConfig());
}
