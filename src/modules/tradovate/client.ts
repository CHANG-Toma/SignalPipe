import { getAccessToken, getTradovateBaseUrl } from "./auth";
import type {
  ContractFindResponse,
  LiquidatePositionRequest,
  PlaceOrderRequest,
  PlaceOrderResponse,
  PlaceOsoRequest,
  TradovateEnvironment,
  TradovatePosition,
} from "./types";

async function tradovateFetch<T>(
  env: TradovateEnvironment,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getAccessToken(env);
  const res = await fetch(`${getTradovateBaseUrl(env)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg =
      typeof json === "object" && json && "errorText" in json
        ? String((json as { errorText: string }).errorText)
        : text.slice(0, 300);
    throw new Error(`Tradovate ${path} failed (${res.status}): ${msg}`);
  }

  return json as T;
}

export async function placeOrder(
  env: TradovateEnvironment,
  order: PlaceOrderRequest,
): Promise<PlaceOrderResponse> {
  if (order.isAutomated !== true) {
    throw new Error("isAutomated must be true for automated orders");
  }
  return tradovateFetch<PlaceOrderResponse>(env, "/order/placeorder", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

/** Entry + optional SL/TP brackets (OCO when both brackets set). */
export async function placeOso(
  env: TradovateEnvironment,
  order: PlaceOsoRequest,
): Promise<PlaceOrderResponse> {
  if (order.isAutomated !== true) {
    throw new Error("isAutomated must be true for automated orders");
  }
  return tradovateFetch<PlaceOrderResponse>(env, "/order/placeoso", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export async function findContract(
  env: TradovateEnvironment,
  symbol: string,
): Promise<ContractFindResponse> {
  const encoded = encodeURIComponent(symbol);
  return tradovateFetch<ContractFindResponse>(
    env,
    `/contract/find?name=${encoded}`,
  );
}

export async function listPositions(
  env: TradovateEnvironment,
): Promise<TradovatePosition[]> {
  const data = await tradovateFetch<TradovatePosition[] | TradovatePosition>(
    env,
    "/position/list",
  );
  return Array.isArray(data) ? data : data ? [data] : [];
}

export async function getNetPosition(
  env: TradovateEnvironment,
  accountId: number,
  symbol: string,
): Promise<{ netPos: number; netPrice?: number; contractId?: number }> {
  const contract = await findContract(env, symbol);
  if (!contract?.id) {
    return { netPos: 0 };
  }
  const positions = await listPositions(env);
  const pos = positions.find(
    (p) => p.accountId === accountId && p.contractId === contract.id,
  );
  return {
    netPos: pos?.netPos ?? 0,
    netPrice: pos?.netPrice,
    contractId: contract.id,
  };
}

export async function liquidatePosition(
  env: TradovateEnvironment,
  body: LiquidatePositionRequest,
): Promise<unknown> {
  return tradovateFetch(env, "/order/liquidateposition", {
    method: "POST",
    body: JSON.stringify({ ...body, admin: body.admin ?? false }),
  });
}

export async function flattenSymbol(
  env: TradovateEnvironment,
  accountId: number,
  symbol: string,
): Promise<unknown> {
  const contract = await findContract(env, symbol);
  if (!contract?.id) {
    throw new Error(`Contract not found for symbol ${symbol}`);
  }
  return liquidatePosition(env, {
    accountId,
    contractId: contract.id,
    admin: false,
  });
}

export async function pingTradovate(
  env: TradovateEnvironment,
): Promise<{ ok: boolean; message: string }> {
  try {
    await getAccessToken(env);
    return { ok: true, message: `Connected to Tradovate ${env}` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unknown Tradovate error",
    };
  }
}
