import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { authFromBrokerAccount } from "@/modules/tradovate/account-auth";
import { pingTradovate } from "@/modules/tradovate/client";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getAppSettings();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const primaryAccount = await prisma.brokerAccount.findFirst({
    where: { enabled: true },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });

  const [recentEvents, ordersToday, failedToday, tradovate] = await Promise.all([
    prisma.webhookEvent.findMany({
      take: 10,
      orderBy: { receivedAt: "desc" },
      include: { orderAttempts: { take: 1, orderBy: { createdAt: "desc" } } },
    }),
    prisma.orderAttempt.count({
      where: {
        createdAt: { gte: startOfDay },
        status: { in: [OrderStatus.SENT, OrderStatus.ACCEPTED, OrderStatus.SKIPPED] },
      },
    }),
    prisma.orderAttempt.count({
      where: {
        createdAt: { gte: startOfDay },
        status: { in: [OrderStatus.FAILED, OrderStatus.REJECTED] },
      },
    }),
    settings.tradingMode === "dry-run"
      ? Promise.resolve({ ok: true, message: "Dry-run mode (API not called)" })
      : primaryAccount?.username && primaryAccount.passwordEnc
        ? pingTradovate(authFromBrokerAccount(primaryAccount))
        : Promise.resolve({
            ok: false,
            message: "No Tradovate credentials on Accounts — add username/password there",
          }),
  ]);

  return NextResponse.json({
    settings: {
      tradingMode: settings.tradingMode,
      tradovateEnv: settings.tradovateEnv,
      killSwitch: settings.killSwitch,
      defaultSymbol: settings.defaultSymbol,
      defaultQty: settings.defaultQty,
    },
    tradovate,
    counters: { ordersToday, failedToday },
    recentEvents,
  });
}
