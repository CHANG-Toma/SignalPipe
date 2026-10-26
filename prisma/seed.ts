import { PrismaClient, OrderAction, MatchType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@signalpipe.local";
  const password = process.env.ADMIN_PASSWORD ?? "change-me-strong-password";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  const defaults: Record<string, string> = {
    webhookSecret: process.env.WEBHOOK_SECRET ?? "change-me-webhook-secret",
    tradingMode: process.env.TRADING_MODE ?? "dry-run",
    tradovateEnv: process.env.TRADOVATE_ENV ?? "demo",
    defaultSymbol: process.env.DEFAULT_SYMBOL ?? "MNQH5",
    defaultQty: process.env.DEFAULT_QTY ?? "1",
    killSwitch: "false",
    accountId: process.env.TRADOVATE_ACCOUNT_ID ?? "",
    accountSpec: process.env.TRADOVATE_ACCOUNT_SPEC ?? "",
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  const mappingCount = await prisma.alertMapping.count();
  if (mappingCount === 0) {
    await prisma.alertMapping.createMany({
      data: [
        {
          pattern: "buy 01",
          matchType: MatchType.CONTAINS,
          action: OrderAction.BUY,
          priority: 10,
        },
        {
          pattern: "sell 01",
          matchType: MatchType.CONTAINS,
          action: OrderAction.SELL,
          priority: 10,
        },
        {
          pattern: "close",
          matchType: MatchType.CONTAINS,
          action: OrderAction.FLATTEN,
          priority: 20,
        },
        {
          pattern: "flat",
          matchType: MatchType.CONTAINS,
          action: OrderAction.FLATTEN,
          priority: 20,
        },
      ],
    });
  }

  const symbolCount = await prisma.symbolMapping.count();
  if (symbolCount === 0) {
    await prisma.symbolMapping.createMany({
      data: [
        {
          tradingViewSymbol: "MNQ1!",
          tradovateSymbol: process.env.DEFAULT_SYMBOL ?? "MNQH5",
          minTick: 0.25,
          lotSize: 2,
        },
        {
          tradingViewSymbol: "NQ1!",
          tradovateSymbol: "NQH5",
          minTick: 0.25,
          lotSize: 20,
        },
        {
          tradingViewSymbol: "MES1!",
          tradovateSymbol: "MESH5",
          minTick: 0.25,
          lotSize: 5,
        },
      ],
    });
  }

  const accountId = process.env.TRADOVATE_ACCOUNT_ID;
  const accountSpec = process.env.TRADOVATE_ACCOUNT_SPEC;
  if (accountId && accountSpec) {
    await prisma.brokerAccount.upsert({
      where: { accountId },
      update: {
        accountSpec,
        environment: process.env.TRADOVATE_ENV ?? "demo",
      },
      create: {
        name: "Primary Tradovate",
        accountId,
        accountSpec,
        environment: process.env.TRADOVATE_ENV ?? "demo",
        isPrimary: true,
      },
    });
  }

  console.log(`Seeded admin user: ${email}`);
  console.log("Default settings, mappings, symbols ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
