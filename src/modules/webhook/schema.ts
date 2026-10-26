import { z } from "zod";

const flexibleNumber = z.union([z.number(), z.string()]);

/**
 * TradingView → SignalPipe alert JSON (Tradovate automation).
 */
export const AlertPayloadSchema = z
  .object({
    symbol: z.string().optional(),
    ticker: z.string().optional(),
    date: z.union([z.string(), z.number()]).optional(),
    data: z.union([z.string(), z.number()]).optional(),
    quantity: flexibleNumber.optional(),
    risk_percentage: flexibleNumber.optional(),
    price: flexibleNumber.optional(),
    order_type: z.string().optional(),
    tp: flexibleNumber.optional(),
    percentage_tp: flexibleNumber.optional(),
    dollar_tp: flexibleNumber.optional(),
    sl: flexibleNumber.optional(),
    percentage_sl: flexibleNumber.optional(),
    dollar_sl: flexibleNumber.optional(),
    trail: flexibleNumber.optional(),
    trail_stop: flexibleNumber.optional(),
    trail_trigger: flexibleNumber.optional(),
    trail_freq: flexibleNumber.optional(),
    update_tp: z.union([z.boolean(), z.string()]).optional(),
    update_sl: z.union([z.boolean(), z.string()]).optional(),
    breakeven: flexibleNumber.optional(),
    breakeven_offset: flexibleNumber.optional(),
    token: z.string().optional(),
    pyramid: z.union([z.boolean(), z.string()]).optional(),
    same_direction_ignore: z.union([z.boolean(), z.string()]).optional(),
    reverse_order_close: z.union([z.boolean(), z.string()]).optional(),
    account_id: z.union([z.string(), z.number()]).optional(),
    multiple_accounts: z
      .array(
        z.object({
          token: z.string().optional(),
          account_id: z.union([z.string(), z.number()]),
          risk_percentage: flexibleNumber.optional(),
          quantity_multiplier: flexibleNumber.optional(),
        }),
      )
      .optional(),
    message: z.union([z.string(), z.number()]).optional(),
    comment: z.string().optional(),
    text: z.string().optional(),
    strategy: z
      .object({
        order: z
          .object({
            id: z.union([z.string(), z.number()]).optional(),
            action: z.string().optional(),
            contracts: flexibleNumber.optional(),
            comment: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type AlertPayload = z.infer<typeof AlertPayloadSchema>;

export function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
  }
  return fallback;
}

export function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
}

export function extractActionRaw(payload: AlertPayload): string {
  const fromData = payload.data !== undefined ? String(payload.data).trim() : "";
  if (fromData) return fromData;
  const fromStrategy = payload.strategy?.order?.action;
  if (fromStrategy) return String(fromStrategy).trim();
  const fromMessage =
    payload.message ?? payload.comment ?? payload.text ?? payload.strategy?.order?.comment;
  return fromMessage !== undefined ? String(fromMessage).trim() : "";
}

export function extractSymbol(payload: AlertPayload): string | undefined {
  const s = payload.symbol || payload.ticker;
  return s ? String(s).trim() : undefined;
}

export function extractStrategyOrderId(payload: AlertPayload): string | undefined {
  const id = payload.strategy?.order?.id;
  return id === undefined || id === null ? undefined : String(id);
}

export function extractMessage(payload: AlertPayload): string {
  return extractActionRaw(payload);
}
