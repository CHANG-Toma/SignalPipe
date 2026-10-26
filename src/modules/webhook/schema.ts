import { z } from "zod";

/**
 * TradingView webhook payload — flexible: TV allows custom JSON templates.
 */
export const TradingViewWebhookSchema = z
  .object({
    message: z.union([z.string(), z.number()]).optional(),
    comment: z.string().optional(),
    text: z.string().optional(),
    symbol: z.string().optional(),
    ticker: z.string().optional(),
    strategy: z
      .object({
        order: z
          .object({
            id: z.union([z.string(), z.number()]).optional(),
            action: z.string().optional(),
            contracts: z.union([z.string(), z.number()]).optional(),
            comment: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type TradingViewWebhook = z.infer<typeof TradingViewWebhookSchema>;

export function extractMessage(payload: TradingViewWebhook): string {
  const candidates = [
    payload.message,
    payload.comment,
    payload.text,
    payload.strategy?.order?.comment,
    payload.strategy?.order?.action,
  ];
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return "";
}

export function extractSymbol(payload: TradingViewWebhook): string | undefined {
  return payload.symbol || payload.ticker || undefined;
}

export function extractStrategyOrderId(payload: TradingViewWebhook): string | undefined {
  const id = payload.strategy?.order?.id;
  return id === undefined || id === null ? undefined : String(id);
}
