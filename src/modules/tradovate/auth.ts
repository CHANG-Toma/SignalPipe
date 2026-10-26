import { getEnv } from "@/lib/env";
import type { TradovateAccessTokenResponse, TradovateEnvironment } from "./types";

const BASE: Record<TradovateEnvironment, string> = {
  demo: "https://demo.tradovateapi.com/v1",
  live: "https://live.tradovateapi.com/v1",
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
  env: TradovateEnvironment;
};

let cache: TokenCache | null = null;

export function getTradovateBaseUrl(env: TradovateEnvironment): string {
  return BASE[env];
}

/**
 * Access token request using Tradovate credentials / API key.
 * Docs: https://api.tradovate.com/
 */
export async function getAccessToken(
  env: TradovateEnvironment,
): Promise<string> {
  const now = Date.now();
  if (cache && cache.env === env && cache.expiresAt > now + 60_000) {
    return cache.accessToken;
  }

  const e = getEnv();
  const username = e.TRADOVATE_USERNAME;
  const password = e.TRADOVATE_PASSWORD;
  const cid = e.TRADOVATE_CID;
  const sec = e.TRADOVATE_SEC;

  if (!username || !password) {
    throw new Error("Tradovate credentials missing (TRADOVATE_USERNAME/PASSWORD)");
  }

  const body: Record<string, string | number> = {
    name: username,
    password,
    appId: e.TRADOVATE_APP_ID,
    appVersion: e.TRADOVATE_APP_VERSION,
    deviceId: e.TRADOVATE_DEVICE_ID || "SignalPipe",
  };

  if (cid) body.cid = Number(cid);
  if (sec) body.sec = sec;

  const res = await fetch(`${getTradovateBaseUrl(env)}/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tradovate auth failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as TradovateAccessTokenResponse & {
    errorText?: string;
  };

  if (!data.accessToken) {
    throw new Error(data.errorText || "Tradovate auth returned no accessToken");
  }

  const expiresAt = data.expirationTime
    ? new Date(data.expirationTime).getTime()
    : now + 50 * 60_000;

  cache = { accessToken: data.accessToken, expiresAt, env };
  return data.accessToken;
}

export function clearTokenCache() {
  cache = null;
}
