import type { OrderAction } from "@prisma/client";
import type { RiskLevels } from "@/modules/webhook/parser";
import type { BracketOrder } from "@/modules/tradovate/types";

export type BracketPlan = {
  bracket1?: BracketOrder;
  bracket2?: BracketOrder;
  exitAction: "Buy" | "Sell";
};

function pointsFromRisk(
  risk: RiskLevels,
  side: "sl" | "tp",
  entry: number,
  lotSize: number,
): number {
  if (side === "sl") {
    if (risk.slPoints > 0) return risk.slPoints;
    if (risk.dollarSl > 0 && lotSize > 0) return risk.dollarSl / lotSize;
    if (risk.percentageSl > 0) return (entry * risk.percentageSl) / 100;
  } else {
    if (risk.tpPoints > 0) return risk.tpPoints;
    if (risk.dollarTp > 0 && lotSize > 0) return risk.dollarTp / lotSize;
    if (risk.percentageTp > 0) return (entry * risk.percentageTp) / 100;
  }
  return 0;
}

/**
 * Build Tradovate OSO brackets from alert risk fields.
 * Prices are absolute levels derived from entry ± points.
 */
export function buildBrackets(
  action: OrderAction,
  risk: RiskLevels,
  lotSize = 1,
): BracketPlan | null {
  if (action === "FLATTEN") return null;

  const entry = risk.entryPrice;
  if (!entry || entry <= 0) return null;

  const exitAction = action === "BUY" ? "Sell" : "Buy";
  const slPts = pointsFromRisk(risk, "sl", entry, lotSize);
  const tpPts = pointsFromRisk(risk, "tp", entry, lotSize);

  if (slPts <= 0 && tpPts <= 0) return null;

  const plan: BracketPlan = { exitAction };

  if (slPts > 0) {
    const stopPrice = action === "BUY" ? entry - slPts : entry + slPts;
    plan.bracket1 = {
      action: exitAction,
      orderType: risk.trail > 0 ? "TrailingStop" : "Stop",
      stopPrice,
    };
  }

  if (tpPts > 0) {
    const price = action === "BUY" ? entry + tpPts : entry - tpPts;
    const tpBracket: BracketOrder = {
      action: exitAction,
      orderType: "Limit",
      price,
    };
    if (plan.bracket1) {
      plan.bracket2 = tpBracket;
    } else {
      plan.bracket1 = tpBracket;
    }
  }

  return plan.bracket1 ? plan : null;
}
