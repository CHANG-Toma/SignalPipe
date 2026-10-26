import type { TradovateAccessTokenResponse, TradovateEnvironment } from "./types";

const BASE: Record<TradovateEnvironment, string> = {
  demo: "https://demo.tradovateapi.com/v1",
  live: "https://live.tradovateapi.com/v1",
};

export type TradovateAuth = {
  env: TradovateEnvironment;
  username: string;
  password: string;
};

type TokenCache = {
  key: string;
  accessToken: string;
  expiresAt: number;
};

const tokenCache = new Map<string, TokenCache>();

export function getTradovateBaseUrl(env: TradovateEnvironment): string {
  return BASE[env];
}

function cacheKey(auth: TradovateAuth): string {
  return `${auth.env}:${auth.username}`;
}

export async function getAccessToken(auth: TradovateAuth): Promise<string> {
  const now = Date.now();
  const key = cacheKey(auth);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.accessToken;
  }

  const res = await fetch(`${getTradovateBaseUrl(auth.env)}/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: auth.username,
      password: auth.password,
      appId: "SignalPipe",
      appVersion: "1.0",
      deviceId: "SignalPipe",
    }),
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

  tokenCache.set(key, { key, accessToken: data.accessToken, expiresAt });
  return data.accessToken;
}

export function clearTokenCache(username?: string) {
  if (!username) {
    tokenCache.clear();
    return;
  }
  for (const key of tokenCache.keys()) {
    if (key.endsWith(`:${username}`)) tokenCache.delete(key);
  }
}
