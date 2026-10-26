export type TradovateEnvironment = "demo" | "live";

export type TradovateAccessTokenResponse = {
  accessToken: string;
  mdAccessToken?: string;
  expirationTime?: string;
  userId?: number;
  name?: string;
};

export type PlaceOrderRequest = {
  accountSpec: string;
  accountId: number;
  action: "Buy" | "Sell";
  symbol: string;
  orderQty: number;
  orderType: "Market" | "Limit" | "Stop" | "StopLimit" | "TrailingStop";
  isAutomated: true;
  price?: number;
  stopPrice?: number;
  timeInForce?: "Day" | "GTC" | "IOC" | "FOK";
  text?: string;
};

export type BracketOrder = {
  action: "Buy" | "Sell";
  orderType: "Limit" | "Stop" | "TrailingStop";
  price?: number;
  stopPrice?: number;
};

export type PlaceOsoRequest = PlaceOrderRequest & {
  bracket1: BracketOrder;
  bracket2?: BracketOrder;
};

export type PlaceOrderResponse = {
  orderId?: number;
  id?: number;
  failureReason?: string;
  failureText?: string;
  [key: string]: unknown;
};

export type LiquidatePositionRequest = {
  accountId: number;
  contractId: number;
  admin?: boolean;
};

export type ContractFindResponse = {
  id: number;
  name?: string;
  [key: string]: unknown;
};

export type TradovatePosition = {
  id?: number;
  accountId: number;
  contractId: number;
  netPos: number;
  netPrice?: number;
  [key: string]: unknown;
};
