import type { AlertMapping, OrderAction, OrderType } from "@prisma/client";
import {
  extractMessage,
  extractStrategyOrderId,
  extractSymbol,
  TradingViewWebhookSchema,
  type TradingViewWebhook,
} from "@/modules/webhook/schema";

export type ParsedAlert = {
  payload: TradingViewWebhook;
  message: string;
  symbol?: string;
  strategyOrderId?: string;
  action: OrderAction;
  quantity?: number;
  orderType: OrderType;
  mappingId: string;
};

export type ParseFailure = {
  payload: TradingViewWebhook | null;
  message: string;
  symbol?: string;
  strategyOrderId?: string;
  error: string;
};

function matches(mapping: AlertMapping, message: string): boolean {
  const hay = message.toLowerCase();
  const needle = mapping.pattern.toLowerCase();

  switch (mapping.matchType) {
    case "EXACT":
      return hay === needle;
    case "CONTAINS":
      return hay.includes(needle);
    case "REGEX":
      try {
        return new RegExp(mapping.pattern, "i").test(message);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Find the highest-priority enabled mapping that matches the message.
 */
export function resolveMapping(
  message: string,
  mappings: AlertMapping[],
): AlertMapping | null {
  const enabled = mappings
    .filter((m) => m.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const m of enabled) {
    if (matches(m, message)) return m;
  }
  return null;
}

export function parseWebhook(
  raw: unknown,
  mappings: AlertMapping[],
): ParsedAlert | ParseFailure {
  const parsed = TradingViewWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      payload: null,
      message: "",
      error: `Invalid JSON shape: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    };
  }

  const payload = parsed.data;
  const message = extractMessage(payload);
  const symbol = extractSymbol(payload);
  const strategyOrderId = extractStrategyOrderId(payload);

  if (!message) {
    return {
      payload,
      message,
      symbol,
      strategyOrderId,
      error: "No message/comment found in webhook payload",
    };
  }

  const mapping = resolveMapping(message, mappings);
  if (!mapping) {
    return {
      payload,
      message,
      symbol,
      strategyOrderId,
      error: `No alert mapping matched message: "${message}"`,
    };
  }

  const qtyFromStrategy = payload.strategy?.order?.contracts;
  const quantity =
    mapping.quantity ??
    (qtyFromStrategy !== undefined ? Number(qtyFromStrategy) : undefined);

  return {
    payload,
    message,
    symbol,
    strategyOrderId,
    action: mapping.action,
    quantity: Number.isFinite(quantity) ? quantity : undefined,
    orderType: mapping.orderType,
    mappingId: mapping.id,
  };
}

export function isParsedAlert(
  result: ParsedAlert | ParseFailure,
): result is ParsedAlert {
  return "action" in result;
}
