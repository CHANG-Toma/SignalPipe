import type { BrokerAccount } from "@prisma/client";

export type AlertSource = "strategy" | "indicator";
export type ExitMode = "none" | "attach" | "multiple";

export type GenerateAlertInput = {
  source: AlertSource;
  symbol: string;
  indicatorAction?: "buy" | "sell" | "close";
  quantity: number | string;
  riskPercentage?: number;
  orderType?: "MKT" | "LMT";
  exitMode?: ExitMode;
  tp?: number;
  percentageTp?: number;
  dollarTp?: number;
  sl?: number;
  percentageSl?: number;
  dollarSl?: number;
  trail?: number;
  trailStop?: number;
  trailTrigger?: number;
  trailFreq?: number;
  breakeven?: number;
  breakevenOffset?: number;
  pyramid?: boolean;
  sameDirectionIgnore?: boolean;
  reverseOrderClose?: boolean;
  token: string;
  primaryAccount: BrokerAccount;
  extraAccounts?: Array<{
    account: BrokerAccount;
    quantityMultiplier: number;
  }>;
};

/** Build TradingView alert JSON + webhook helpers for Tradovate execution. */
export function generateAlertPayload(input: GenerateAlertInput) {
  const data =
    input.source === "strategy"
      ? "{{strategy.order.action}}"
      : (input.indicatorAction ?? "buy");

  const quantity =
    input.source === "strategy" &&
    (input.quantity === "" || input.quantity === "{{strategy.order.contracts}}")
      ? "{{strategy.order.contracts}}"
      : input.quantity;

  const useRisk = (input.riskPercentage ?? 0) > 0;
  const exitsOff = input.exitMode === "none";

  const payload: Record<string, unknown> = {
    symbol: input.symbol || "{{ticker}}",
    date: "{{timenow}}",
    data,
    quantity: useRisk ? 0 : quantity,
    risk_percentage: input.riskPercentage ?? 0,
    price: "{{close}}",
    order_type: input.orderType ?? "MKT",
    tp: exitsOff ? 0 : (input.tp ?? 0),
    percentage_tp: exitsOff ? 0 : (input.percentageTp ?? 0),
    dollar_tp: exitsOff ? 0 : (input.dollarTp ?? 0),
    sl: exitsOff ? 0 : (input.sl ?? 0),
    percentage_sl: exitsOff ? 0 : (input.percentageSl ?? 0),
    dollar_sl: exitsOff ? 0 : (input.dollarSl ?? 0),
    trail: input.trail ?? 0,
    trail_stop: input.trailStop ?? 0,
    trail_trigger: input.trailTrigger ?? 0,
    trail_freq: input.trailFreq ?? 0,
    update_tp: false,
    update_sl: false,
    breakeven: input.breakeven ?? 0,
    breakeven_offset: input.breakevenOffset ?? 0,
    token: input.token,
    pyramid: input.pyramid ?? false,
    same_direction_ignore: input.sameDirectionIgnore ?? false,
    reverse_order_close: input.reverseOrderClose ?? true,
    account_id: input.primaryAccount.accountId,
  };

  const extras = input.extraAccounts ?? [];
  if (extras.length > 0) {
    payload.multiple_accounts = extras.map((e) => ({
      token: input.token,
      account_id: e.account.accountId,
      risk_percentage: 0,
      quantity_multiplier: e.quantityMultiplier,
    }));
  }

  return payload;
}

export function stringifyAlertJson(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

export function buildWebhookUrl(baseUrl: string, secret: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/webhook/${encodeURIComponent(secret)}`;
}
