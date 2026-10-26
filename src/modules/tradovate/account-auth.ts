import type { BrokerAccount } from "@prisma/client";
import { decryptSecret } from "@/lib/secrets";
import type { TradovateAuth } from "@/modules/tradovate/auth";
import type { TradovateEnvironment } from "@/modules/tradovate/types";

/** Build Tradovate auth from a BrokerAccount row (UI credentials). */
export function authFromBrokerAccount(account: BrokerAccount): TradovateAuth {
  if (!account.username || !account.passwordEnc) {
    throw new Error(
      `Account "${account.name}" has no Tradovate login — reconnect it on Accounts`,
    );
  }

  return {
    env: (account.environment === "live" ? "live" : "demo") as TradovateEnvironment,
    username: account.username,
    password: decryptSecret(account.passwordEnc),
  };
}
