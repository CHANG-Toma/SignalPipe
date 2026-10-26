import { prisma } from "@/lib/prisma";

/**
 * Map TradingView symbol (e.g. MNQ1!, NQ) → Tradovate contract symbol.
 */
export async function resolveTradovateSymbol(
  tradingViewSymbol: string | undefined,
  fallback: string,
): Promise<{ tradovateSymbol: string; mapped: boolean }> {
  if (!tradingViewSymbol) {
    return { tradovateSymbol: fallback, mapped: false };
  }

  const key = tradingViewSymbol.trim();
  const mapping = await prisma.symbolMapping.findFirst({
    where: {
      enabled: true,
      OR: [
        { tradingViewSymbol: key },
        { tradingViewSymbol: key.replace(/1!$/, "") },
        { tradingViewSymbol: `${key.replace(/1!$/, "")}1!` },
      ],
    },
  });

  if (mapping) {
    return { tradovateSymbol: mapping.tradovateSymbol, mapped: true };
  }

  // If no mapping, pass through (user may already send Tradovate symbol)
  return { tradovateSymbol: key || fallback, mapped: false };
}
