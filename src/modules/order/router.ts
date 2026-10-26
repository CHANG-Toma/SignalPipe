import {
  OrderAction,
  OrderStatus,
  type BrokerAccount,
  type OrderType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AppSettings, TradingMode } from "@/lib/settings";
import { buildBrackets } from "@/modules/order/brackets";
import { planPositionAction } from "@/modules/order/policy";
import { authFromBrokerAccount } from "@/modules/tradovate/account-auth";
import {
  flattenSymbol,
  getNetPosition,
  placeOrder,
  placeOso,
} from "@/modules/tradovate/client";
import type { PlaceOrderRequest, PlaceOsoRequest } from "@/modules/tradovate/types";
import { resolveTradovateSymbol } from "@/modules/symbol/resolve";
import type { ParsedAlert } from "@/modules/webhook/parser";

function toTradovateAction(action: OrderAction): "Buy" | "Sell" {
  if (action === OrderAction.BUY) return "Buy";
  if (action === OrderAction.SELL) return "Sell";
  throw new Error("FLATTEN has no Buy/Sell side");
}

function toTradovateOrderType(orderType: OrderType): PlaceOrderRequest["orderType"] {
  return orderType === "LIMIT" ? "Limit" : "Market";
}

function resolveEnv(
  mode: TradingMode,
  accountEnv: string | undefined,
  settingsEnv: AppSettings["tradovateEnv"],
) {
  if (mode === "live") return "live" as const;
  if (accountEnv === "live" || accountEnv === "demo") return accountEnv;
  return settingsEnv;
}

export type RouteResult = {
  status: OrderStatus;
  dryRun: boolean;
  attemptId: string;
  errorMessage?: string;
  results?: RouteResult[];
};

async function resolveAccounts(
  alert: ParsedAlert,
): Promise<Array<{ account: BrokerAccount; multiplier: number }>> {
  const enabled = await prisma.brokerAccount.findMany({
    where: { enabled: true },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });

  if (alert.targets.length > 0) {
    const resolved: Array<{ account: BrokerAccount; multiplier: number }> = [];
    for (const t of alert.targets) {
      const account =
        enabled.find((a) => a.accountId === t.accountId) ||
        enabled.find((a) => a.accountSpec === t.accountId);
      if (account) resolved.push({ account, multiplier: t.quantityMultiplier });
    }
    if (resolved.length > 0) return resolved;
  }

  const primary = enabled.find((a) => a.isPrimary) || enabled[0] || null;
  if (primary) {
    return [{ account: primary, multiplier: primary.quantityMultiplier }];
  }

  return [];
}

async function resolveLotSize(tvSymbol: string | undefined): Promise<number> {
  if (!tvSymbol) return 1;
  const mapping = await prisma.symbolMapping.findFirst({
    where: {
      enabled: true,
      OR: [
        { tradingViewSymbol: tvSymbol },
        { tradingViewSymbol: tvSymbol.replace(/1!$/, "") },
      ],
    },
  });
  return mapping?.lotSize && mapping.lotSize > 0 ? mapping.lotSize : 1;
}

async function routeOne(
  eventId: string,
  alert: ParsedAlert,
  settings: AppSettings,
  account: BrokerAccount,
  multiplier: number,
  symbol: string,
  lotSize: number,
): Promise<RouteResult> {
  const baseQty = alert.quantity ?? settings.defaultQty;
  const qty = Math.max(1, Math.floor(baseQty * multiplier));
  const dryRun = settings.tradingMode === "dry-run";
  const env = resolveEnv(settings.tradingMode, account.environment, settings.tradovateEnv);
  const accountIdNum = Number(account.accountId);
  const auth =
    dryRun || account.id === "dry-run"
      ? null
      : (() => {
          const a = authFromBrokerAccount(account);
          a.env = env;
          return a;
        })();

  const requestPreview = {
    action: alert.action,
    symbol,
    orderQty: qty,
    orderType: alert.orderType,
    tradingMode: settings.tradingMode,
    message: alert.message,
    accountId: account.accountId,
    reverseOrderClose: alert.reverseOrderClose,
    sameDirectionIgnore: alert.sameDirectionIgnore,
    pyramid: alert.pyramid,
    risk: alert.risk,
  };

  const skipAttempt = async (status: OrderStatus, errorMessage: string, extra?: object) => {
    const attempt = await prisma.orderAttempt.create({
      data: {
        webhookEventId: eventId,
        status,
        dryRun,
        side: alert.action,
        quantity: qty,
        symbol,
        brokerAccountId:
          account.id === "dry-run" ? null : account.id,
        requestPayload: JSON.stringify({ ...requestPreview, ...extra }),
        errorMessage,
      },
    });
    return {
      status,
      dryRun,
      attemptId: attempt.id,
      errorMessage,
    } satisfies RouteResult;
  };

  if (settings.killSwitch) {
    return skipAttempt(OrderStatus.SKIPPED, "Kill switch active — order ignored");
  }

  if (alert.riskPercentage > 0 && (!alert.quantity || alert.quantity <= 0)) {
    return skipAttempt(
      OrderStatus.FAILED,
      "risk_percentage without fixed quantity is not supported yet — set quantity > 0",
    );
  }

  // Position policy (live or dry-run simulation)
  let netPos = 0;
  if (!dryRun && auth && accountIdNum) {
    try {
      const pos = await getNetPosition(auth, accountIdNum, symbol);
      netPos = pos.netPos;
    } catch {
      netPos = 0;
    }
  }

  const plan = planPositionAction({
    action: alert.action,
    netPos,
    reverseOrderClose: alert.reverseOrderClose,
    pyramid: alert.pyramid,
    sameDirectionIgnore: alert.sameDirectionIgnore,
  });

  if (plan.skip) {
    return skipAttempt(OrderStatus.SKIPPED, plan.skip, { netPos, plan });
  }

  if (dryRun) {
    const attempt = await prisma.orderAttempt.create({
      data: {
        webhookEventId: eventId,
        status: OrderStatus.SKIPPED,
        dryRun: true,
        side: alert.action,
        quantity: qty,
        symbol,
        brokerAccountId:
          account.id === "dry-run" ? null : account.id,
        requestPayload: JSON.stringify({ ...requestPreview, netPos, plan }),
        responsePayload: JSON.stringify({
          note: "dry-run: order not sent to Tradovate",
          simulated: true,
        }),
      },
    });
    return { status: OrderStatus.SKIPPED, dryRun: true, attemptId: attempt.id };
  }

  if (!accountIdNum || !account.accountSpec) {
    return skipAttempt(OrderStatus.FAILED, "Missing Tradovate accountId / accountSpec");
  }

  if (!auth) {
    return skipAttempt(
      OrderStatus.FAILED,
      "Tradovate credentials missing on this account — edit Accounts and set username/password",
    );
  }

  const pending = await prisma.orderAttempt.create({
    data: {
      webhookEventId: eventId,
      status: OrderStatus.PENDING,
      dryRun: false,
      side: alert.action,
      quantity: qty,
      symbol,
      brokerAccountId:
        account.id === "dry-run" ? null : account.id,
      requestPayload: JSON.stringify({ ...requestPreview, netPos, plan }),
    },
  });

  try {
    let response: unknown;
    let tradovateOrderId: string | undefined;

    if (plan.flattenFirst) {
      try {
        await flattenSymbol(auth, accountIdNum, symbol);
      } catch {
        // no position is acceptable
      }
    }

    if (plan.placeEntry && alert.action !== OrderAction.FLATTEN) {
      const brackets = buildBrackets(alert.action, alert.risk, lotSize);
      const base: PlaceOrderRequest = {
        accountSpec: account.accountSpec,
        accountId: accountIdNum,
        action: toTradovateAction(alert.action),
        symbol,
        orderQty: qty,
        orderType: toTradovateOrderType(alert.orderType),
        isAutomated: true,
        text: `SignalPipe: ${alert.message}`.slice(0, 64),
      };

      if (alert.orderType === "LIMIT" && alert.risk.entryPrice) {
        base.price = alert.risk.entryPrice;
      }

      if (brackets?.bracket1) {
        const oso: PlaceOsoRequest = {
          ...base,
          bracket1: brackets.bracket1,
          ...(brackets.bracket2 ? { bracket2: brackets.bracket2 } : {}),
        };
        response = await placeOso(auth, oso);
      } else {
        response = await placeOrder(auth, base);
      }

      const r = response as { orderId?: number; id?: number };
      tradovateOrderId = String(r.orderId ?? r.id ?? "");
    } else if (alert.action === OrderAction.FLATTEN) {
      response = { flattened: true };
    }

    const updated = await prisma.orderAttempt.update({
      where: { id: pending.id },
      data: {
        status: OrderStatus.ACCEPTED,
        responsePayload: JSON.stringify(response ?? { ok: true }),
        tradovateOrderId: tradovateOrderId || null,
      },
    });

    return { status: updated.status, dryRun: false, attemptId: updated.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown order error";
    const updated = await prisma.orderAttempt.update({
      where: { id: pending.id },
      data: { status: OrderStatus.FAILED, errorMessage: message },
    });
    return {
      status: OrderStatus.FAILED,
      dryRun: false,
      attemptId: updated.id,
      errorMessage: message,
    };
  }
}

export async function routeOrder(
  eventId: string,
  alert: ParsedAlert,
  settings: AppSettings,
): Promise<RouteResult> {
  const { tradovateSymbol } = await resolveTradovateSymbol(
    alert.symbol,
    settings.defaultSymbol,
  );
  const lotSize = await resolveLotSize(alert.symbol);
  const accounts = await resolveAccounts(alert);

  if (accounts.length === 0) {
    // Dry-run works without a Tradovate account (local pipeline tests).
    if (settings.tradingMode === "dry-run") {
      const synthetic: BrokerAccount = {
        id: "dry-run",
        name: "Dry-run (no account)",
        accountId: alert.accountId || "0",
        accountSpec: "DRYRUN",
        environment: settings.tradovateEnv,
        enabled: true,
        isPrimary: true,
        quantityMultiplier: 1,
        username: null,
        passwordEnc: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return routeOne(
        eventId,
        alert,
        settings,
        synthetic,
        1,
        tradovateSymbol,
        lotSize,
      );
    }

    const attempt = await prisma.orderAttempt.create({
      data: {
        webhookEventId: eventId,
        status: OrderStatus.FAILED,
        dryRun: false,
        side: alert.action,
        quantity: alert.quantity ?? settings.defaultQty,
        symbol: tradovateSymbol,
        requestPayload: JSON.stringify({ alert, note: "no broker account" }),
        errorMessage: "No broker account configured — add one in Accounts",
      },
    });
    return {
      status: OrderStatus.FAILED,
      dryRun: false,
      attemptId: attempt.id,
      errorMessage: attempt.errorMessage ?? undefined,
    };
  }

  const results: RouteResult[] = [];
  for (const { account, multiplier } of accounts) {
    results.push(
      await routeOne(
        eventId,
        alert,
        settings,
        account,
        multiplier,
        tradovateSymbol,
        lotSize,
      ),
    );
  }

  const failed = results.find((r) => r.status === OrderStatus.FAILED);
  const primary = failed ?? results[0]!;
  return { ...primary, results };
}
