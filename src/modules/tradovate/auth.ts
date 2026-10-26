import { getEnv } from "@/lib/env";
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

function mapAuthError(raw: string): string {
  const text = raw.trim();
  if (/app is not registered/i.test(text)) {
    return (
      "Tradovate app not registered — need a personal live account (≥ $1k) with API Access ($25/mo), " +
      "then set TRADOVATE_CID / TRADOVATE_SEC in .env (prop/Lucid accounts are not eligible)"
    );
  }
  return text.slice(0, 300);
}

export async function getAccessToken(auth: TradovateAuth): Promise<string> {
  const now = Date.now();
  const key = cacheKey(auth);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.accessToken;
  }

  const e = getEnv();
  if (!e.TRADOVATE_CID || !e.TRADOVATE_SEC) {
    throw new Error(
      "Missing TRADOVATE_CID / TRADOVATE_SEC — generate them on a personal live Tradovate account " +
        "with API Access (Application Settings → API Access). Prop/Lucid accounts cannot do this.",
    );
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
      cid: Number(e.TRADOVATE_CID),
      sec: e.TRADOVATE_SEC,
    }),
  });

  const text = await res.text();
  let data: (TradovateAccessTokenResponse & { errorText?: string }) | null = null;
  try {
    data = text ? (JSON.parse(text) as TradovateAccessTokenResponse & { errorText?: string }) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(mapAuthError(data?.errorText || text || `HTTP ${res.status}`));
  }

  if (!data?.accessToken) {
    throw new Error(mapAuthError(data?.errorText || "Tradovate auth returned no accessToken"));
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
