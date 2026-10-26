import { OrderAction, OrderStatus, type OrderType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AppSettings, TradingMode } from "@/lib/settings";
import { flattenSymbol, placeOrder } from "@/modules/tradovate/client";
import type { PlaceOrderRequest } from "@/modules/tradovate/types";
import type { ParsedAlert } from "@/modules/webhook/parser";

function toTradovateAction(action: OrderAction): "Buy" | "Sell" {
  if (action === OrderAction.BUY) return "Buy";
  if (action === OrderAction.SELL) return "Sell";
  throw new Error("FLATTEN has no Buy/Sell side");
}

function toTradovateOrderType(orderType: OrderType): PlaceOrderRequest["orderType"] {
  return orderType === "LIMIT" ? "Limit" : "Market";
}

function resolveEnv(mode: TradingMode, settingsEnv: AppSettings["tradovateEnv"]) {
  if (mode === "live") return "live" as const;
  return settingsEnv;
}

export type RouteResult = {
  status: OrderStatus;
  dryRun: boolean;
  attemptId: string;
  errorMessage?: string;
};

/**
 * Route a parsed alert to Tradovate (or dry-run / skip).
 */
export async function routeOrder(
  eventId: string,
  alert: ParsedAlert,
  settings: AppSettings,
): Promise<RouteResult> {
  const qty = alert.quantity ?? settings.defaultQty;
  const symbol = settings.defaultSymbol;
  const dryRun = settings.tradingMode === "dry-run";

  const requestPreview = {
    action: alert.action,
    symbol,
    orderQty: qty,
    orderType: alert.orderType,
    tradingMode: settings.tradingMode,
    message: alert.message,
  };

  if (settings.killSwitch) {
    const attempt = await prisma.orderAttempt.create({
      data: {
        webhookEventId: eventId,
        status: OrderStatus.SKIPPED,
        dryRun,
        side: alert.action,
        quantity: qty,
        symbol,
        requestPayload: JSON.stringify(requestPreview),
        errorMessage: "Kill switch active — order ignored",
      },
    });
    return {
      status: OrderStatus.SKIPPED,
      dryRun,
      attemptId: attempt.id,
      errorMessage: attempt.errorMessage ?? undefined,
    };
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
        requestPayload: JSON.stringify(requestPreview),
        responsePayload: JSON.stringify({ note: "dry-run: order not sent" }),
      },
    });
    return { status: OrderStatus.SKIPPED, dryRun: true, attemptId: attempt.id };
  }

  const env = resolveEnv(settings.tradingMode, settings.tradovateEnv);
  const accountId = Number(settings.accountId || process.env.TRADOVATE_ACCOUNT_ID || "");
  const accountSpec =
    settings.accountSpec || process.env.TRADOVATE_ACCOUNT_SPEC || "";

  if (!accountId || !accountSpec) {
    const attempt = await prisma.orderAttempt.create({
      data: {
        webhookEventId: eventId,
        status: OrderStatus.FAILED,
        dryRun: false,
        side: alert.action,
        quantity: qty,
        symbol,
        requestPayload: JSON.stringify(requestPreview),
        errorMessage: "Missing Tradovate accountId / accountSpec in settings",
      },
    });
    return {
      status: OrderStatus.FAILED,
      dryRun: false,
      attemptId: attempt.id,
      errorMessage: attempt.errorMessage ?? undefined,
    };
  }

  const pending = await prisma.orderAttempt.create({
    data: {
      webhookEventId: eventId,
      status: OrderStatus.PENDING,
      dryRun: false,
      side: alert.action,
      quantity: qty,
      symbol,
      requestPayload: JSON.stringify(requestPreview),
    },
  });

  try {
    let response: unknown;
    let tradovateOrderId: string | undefined;

    if (alert.action === OrderAction.FLATTEN) {
      response = await flattenSymbol(env, accountId, symbol);
    } else {
      const order: PlaceOrderRequest = {
        accountSpec,
        accountId,
        action: toTradovateAction(alert.action),
        symbol,
        orderQty: qty,
        orderType: toTradovateOrderType(alert.orderType),
        isAutomated: true,
        text: `SignalPipe: ${alert.message}`.slice(0, 64),
      };
      response = await placeOrder(env, order);
      const r = response as { orderId?: number; id?: number };
      tradovateOrderId = String(r.orderId ?? r.id ?? "");
    }

    const updated = await prisma.orderAttempt.update({
      where: { id: pending.id },
      data: {
        status: OrderStatus.ACCEPTED,
        responsePayload: JSON.stringify(response),
        tradovateOrderId: tradovateOrderId || null,
      },
    });

    return { status: updated.status, dryRun: false, attemptId: updated.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown order error";
    const updated = await prisma.orderAttempt.update({
      where: { id: pending.id },
      data: {
        status: OrderStatus.FAILED,
        errorMessage: message,
      },
    });
    return {
      status: OrderStatus.FAILED,
      dryRun: false,
      attemptId: updated.id,
      errorMessage: message,
    };
  }
}
