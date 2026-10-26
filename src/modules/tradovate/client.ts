import { getAccessToken, getTradovateBaseUrl, type TradovateAuth } from "./auth";
import type {
  ContractFindResponse,
  LiquidatePositionRequest,
  PlaceOrderRequest,
  PlaceOrderResponse,
  PlaceOsoRequest,
  TradovateAccount,
  TradovatePosition,
} from "./types";

async function tradovateFetch<T>(
  auth: TradovateAuth,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getAccessToken(auth);
  const res = await fetch(`${getTradovateBaseUrl(auth.env)}${path}`, {
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
  auth: TradovateAuth,
  order: PlaceOrderRequest,
): Promise<PlaceOrderResponse> {
  if (order.isAutomated !== true) {
    throw new Error("isAutomated must be true for automated orders");
  }
  return tradovateFetch<PlaceOrderResponse>(auth, "/order/placeorder", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export async function placeOso(
  auth: TradovateAuth,
  order: PlaceOsoRequest,
): Promise<PlaceOrderResponse> {
  if (order.isAutomated !== true) {
    throw new Error("isAutomated must be true for automated orders");
  }
  return tradovateFetch<PlaceOrderResponse>(auth, "/order/placeoso", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export async function findContract(
  auth: TradovateAuth,
  symbol: string,
): Promise<ContractFindResponse> {
  const encoded = encodeURIComponent(symbol);
  return tradovateFetch<ContractFindResponse>(auth, `/contract/find?name=${encoded}`);
}

export async function listAccounts(auth: TradovateAuth): Promise<TradovateAccount[]> {
  const data = await tradovateFetch<TradovateAccount[] | TradovateAccount>(
    auth,
    "/account/list",
  );
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.filter((a) => a?.id != null && a?.name);
}

export async function listPositions(auth: TradovateAuth): Promise<TradovatePosition[]> {
  const data = await tradovateFetch<TradovatePosition[] | TradovatePosition>(
    auth,
    "/position/list",
  );
  return Array.isArray(data) ? data : data ? [data] : [];
}

export async function getNetPosition(
  auth: TradovateAuth,
  accountId: number,
  symbol: string,
): Promise<{ netPos: number; netPrice?: number; contractId?: number }> {
  const contract = await findContract(auth, symbol);
  if (!contract?.id) {
    return { netPos: 0 };
  }
  const positions = await listPositions(auth);
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
  auth: TradovateAuth,
  body: LiquidatePositionRequest,
): Promise<unknown> {
  return tradovateFetch(auth, "/order/liquidateposition", {
    method: "POST",
    body: JSON.stringify({ ...body, admin: body.admin ?? false }),
  });
}

export async function flattenSymbol(
  auth: TradovateAuth,
  accountId: number,
  symbol: string,
): Promise<unknown> {
  const contract = await findContract(auth, symbol);
  if (!contract?.id) {
    throw new Error(`Contract not found for symbol ${symbol}`);
  }
  return liquidatePosition(auth, {
    accountId,
    contractId: contract.id,
    admin: false,
  });
}

export async function pingTradovate(
  auth: TradovateAuth,
): Promise<{ ok: boolean; message: string; accounts?: TradovateAccount[] }> {
  try {
    await getAccessToken(auth);
    const accounts = await listAccounts(auth);
    return {
      ok: true,
      message: `Connected as ${auth.username} (${accounts.length} account${accounts.length === 1 ? "" : "s"})`,
      accounts,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unknown Tradovate error",
    };
  }
}
