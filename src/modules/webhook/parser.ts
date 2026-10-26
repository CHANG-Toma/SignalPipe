import type { AlertMapping, OrderAction, OrderType } from "@prisma/client";
import {
  AlertPayloadSchema,
  extractActionRaw,
  extractStrategyOrderId,
  extractSymbol,
  toBool,
  toNumber,
  type AlertPayload,
} from "@/modules/webhook/schema";

export type TargetAccount = {
  accountId: string;
  quantityMultiplier: number;
};

export type RiskLevels = {
  entryPrice?: number;
  tpPoints: number;
  percentageTp: number;
  dollarTp: number;
  slPoints: number;
  percentageSl: number;
  dollarSl: number;
  trail: number;
  trailStop: number;
  trailTrigger: number;
  trailFreq: number;
  breakeven: number;
  breakevenOffset: number;
  updateTp: boolean;
  updateSl: boolean;
};

export type ParsedAlert = {
  payload: AlertPayload;
  message: string;
  symbol?: string;
  strategyOrderId?: string;
  action: OrderAction;
  quantity?: number;
  orderType: OrderType;
  mappingId?: string;
  format: "standard" | "legacy";
  accountId?: string;
  reverseOrderClose: boolean;
  sameDirectionIgnore: boolean;
  pyramid: boolean;
  riskPercentage: number;
  targets: TargetAccount[];
  risk: RiskLevels;
};

export type ParseFailure = {
  payload: AlertPayload | null;
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

function normalizeAction(raw: string): OrderAction | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v === "buy" || v === "long" || v === "enterlong" || v.startsWith("buy ")) return "BUY";
  if (v === "sell" || v === "short" || v === "entershort" || v.startsWith("sell ")) return "SELL";
  if (
    v === "close" ||
    v === "flat" ||
    v === "flatten" ||
    v === "exit" ||
    v.includes("close") ||
    v.includes("flat")
  ) {
    return "FLATTEN";
  }
  return null;
}

function parseOrderType(raw: string | undefined, fallback: OrderType = "MARKET"): OrderType {
  if (!raw) return fallback;
  const v = raw.trim().toUpperCase();
  if (v === "LMT" || v === "LIMIT") return "LIMIT";
  return "MARKET";
}

function extractRisk(payload: AlertPayload): RiskLevels {
  return {
    entryPrice: toNumber(payload.price),
    tpPoints: toNumber(payload.tp) ?? 0,
    percentageTp: toNumber(payload.percentage_tp) ?? 0,
    dollarTp: toNumber(payload.dollar_tp) ?? 0,
    slPoints: toNumber(payload.sl) ?? 0,
    percentageSl: toNumber(payload.percentage_sl) ?? 0,
    dollarSl: toNumber(payload.dollar_sl) ?? 0,
    trail: toNumber(payload.trail) ?? 0,
    trailStop: toNumber(payload.trail_stop) ?? 0,
    trailTrigger: toNumber(payload.trail_trigger) ?? 0,
    trailFreq: toNumber(payload.trail_freq) ?? 0,
    breakeven: toNumber(payload.breakeven) ?? 0,
    breakevenOffset: toNumber(payload.breakeven_offset) ?? 0,
    updateTp: toBool(payload.update_tp, false),
    updateSl: toBool(payload.update_sl, false),
  };
}

function buildTargets(payload: AlertPayload): TargetAccount[] {
  const targets: TargetAccount[] = [];
  const primary = payload.account_id !== undefined ? String(payload.account_id) : undefined;
  if (primary) targets.push({ accountId: primary, quantityMultiplier: 1 });

  for (const extra of payload.multiple_accounts ?? []) {
    const id = String(extra.account_id);
    const mult = toNumber(extra.quantity_multiplier) ?? 1;
    if (!targets.some((t) => t.accountId === id)) {
      targets.push({ accountId: id, quantityMultiplier: mult });
    }
  }
  return targets;
}

function baseFlags(payload: AlertPayload) {
  return {
    reverseOrderClose: toBool(payload.reverse_order_close, false),
    sameDirectionIgnore: toBool(payload.same_direction_ignore, false),
    pyramid: toBool(payload.pyramid, false),
    riskPercentage: toNumber(payload.risk_percentage) ?? 0,
    targets: buildTargets(payload),
    risk: extractRisk(payload),
  };
}

function parseStandard(payload: AlertPayload): ParsedAlert | ParseFailure {
  const message = extractActionRaw(payload);
  const symbol = extractSymbol(payload);
  const strategyOrderId = extractStrategyOrderId(payload);
  const action = normalizeAction(message);

  if (!action) {
    return {
      payload,
      message,
      symbol,
      strategyOrderId,
      error: `Unknown action in "data": "${message || "(empty)"}" (expected buy/sell/close)`,
    };
  }

  const quantity =
    toNumber(payload.quantity) ?? toNumber(payload.strategy?.order?.contracts);

  return {
    payload,
    message,
    symbol,
    strategyOrderId,
    action,
    quantity: quantity !== undefined && quantity > 0 ? Math.floor(quantity) : undefined,
    orderType: parseOrderType(payload.order_type),
    format: "standard",
    accountId: payload.account_id !== undefined ? String(payload.account_id) : undefined,
    ...baseFlags(payload),
  };
}

function parseLegacy(
  payload: AlertPayload,
  mappings: AlertMapping[],
): ParsedAlert | ParseFailure {
  const message = extractActionRaw(payload);
  const symbol = extractSymbol(payload);
  const strategyOrderId = extractStrategyOrderId(payload);

  if (!message) {
    return {
      payload,
      message,
      symbol,
      strategyOrderId,
      error: "No data/message found in webhook payload",
    };
  }

  const mapping = resolveMapping(message, mappings);
  if (!mapping) {
    const direct = normalizeAction(message);
    if (direct) {
      return {
        payload,
        message,
        symbol,
        strategyOrderId,
        action: direct,
        quantity: toNumber(payload.quantity) ?? toNumber(payload.strategy?.order?.contracts),
        orderType: parseOrderType(payload.order_type),
        format: "standard",
        accountId: payload.account_id !== undefined ? String(payload.account_id) : undefined,
        ...baseFlags(payload),
      };
    }
    return {
      payload,
      message,
      symbol,
      strategyOrderId,
      error: `No mapping matched message: "${message}"`,
    };
  }

  return {
    payload,
    message,
    symbol,
    strategyOrderId,
    action: mapping.action,
    quantity:
      mapping.quantity ??
      toNumber(payload.quantity) ??
      toNumber(payload.strategy?.order?.contracts),
    orderType: mapping.orderType,
    mappingId: mapping.id,
    format: "legacy",
    accountId: payload.account_id !== undefined ? String(payload.account_id) : undefined,
    ...baseFlags(payload),
  };
}

export function parseWebhook(
  raw: unknown,
  mappings: AlertMapping[],
): ParsedAlert | ParseFailure {
  const parsed = AlertPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      payload: null,
      message: "",
      error: `Invalid JSON shape: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    };
  }

  const payload = parsed.data;
  if (payload.data !== undefined && String(payload.data).trim().length > 0) {
    return parseStandard(payload);
  }
  return parseLegacy(payload, mappings);
}

export function isParsedAlert(
  result: ParsedAlert | ParseFailure,
): result is ParsedAlert {
  return "action" in result;
}
