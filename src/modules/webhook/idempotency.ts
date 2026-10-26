import { createHash } from "crypto";

/**
 * Build a stable key so TradingView retries don't place duplicate orders.
 * Prefers strategy order id when present; otherwise hashes message+symbol+time bucket.
 */
export function buildIdempotencyKey(input: {
  strategyOrderId?: string;
  message: string;
  symbol?: string;
  receivedAt?: Date;
}): string {
  if (input.strategyOrderId) {
    return `soid:${input.strategyOrderId}`;
  }

  // 30s bucket reduces accidental duplicates from near-simultaneous retries
  const bucket = Math.floor((input.receivedAt ?? new Date()).getTime() / 30_000);
  const material = `${input.message}|${input.symbol ?? ""}|${bucket}`;
  const hash = createHash("sha256").update(material).digest("hex").slice(0, 24);
  return `hash:${hash}`;
}
