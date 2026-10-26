import type { OrderAction } from "@prisma/client";

export type PositionPlan = {
  skip?: string;
  flattenFirst: boolean;
  placeEntry: boolean;
};

/**
 * Position handling matrix (reverse_order_close × pyramid × same_direction_ignore).
 */
export function planPositionAction(input: {
  action: OrderAction;
  netPos: number;
  reverseOrderClose: boolean;
  pyramid: boolean;
  sameDirectionIgnore: boolean;
}): PositionPlan {
  const { action, netPos, reverseOrderClose, pyramid, sameDirectionIgnore } = input;

  if (action === "FLATTEN") {
    if (netPos === 0) {
      return { skip: "Already flat — close ignored", flattenFirst: false, placeEntry: false };
    }
    return { flattenFirst: true, placeEntry: false };
  }

  const isLong = netPos > 0;
  const isShort = netPos < 0;
  const sameDirection =
    (action === "BUY" && isLong) || (action === "SELL" && isShort);
  const oppositeDirection =
    (action === "BUY" && isShort) || (action === "SELL" && isLong);

  if (sameDirectionIgnore && sameDirection) {
    return {
      skip: "same_direction_ignore — position already in this direction",
      flattenFirst: false,
      placeEntry: false,
    };
  }

  if (!reverseOrderClose) {
    return { flattenFirst: false, placeEntry: true };
  }

  // reverse_order_close = true
  if (pyramid) {
    // Close opposite only; stack same direction
    return {
      flattenFirst: oppositeDirection,
      placeEntry: true,
    };
  }

  // Close any existing position before new entry
  return {
    flattenFirst: netPos !== 0,
    placeEntry: true,
  };
}
