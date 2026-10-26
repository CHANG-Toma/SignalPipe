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
  orderType: "Market" | "Limit" | "Stop" | "StopLimit";
  isAutomated: true;
  price?: number;
  stopPrice?: number;
  timeInForce?: "Day" | "GTC" | "IOC" | "FOK";
  text?: string;
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
