import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authFromBrokerAccount } from "@/modules/tradovate/account-auth";
import { getAccessToken, type TradovateAuth } from "@/modules/tradovate/auth";
import { pingTradovate } from "@/modules/tradovate/client";

const BodySchema = z.object({
  id: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  environment: z.enum(["demo", "live"]).default("demo"),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    let auth: TradovateAuth;

    if (parsed.data.id) {
      const account = await prisma.brokerAccount.findUnique({
        where: { id: parsed.data.id },
      });
      if (!account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      auth = authFromBrokerAccount(account);
    } else if (parsed.data.username && parsed.data.password) {
      auth = {
        env: parsed.data.environment,
        username: parsed.data.username,
        password: parsed.data.password,
      };
    } else {
      return NextResponse.json(
        { error: "Provide account id or username/password" },
        { status: 400 },
      );
    }

    await getAccessToken(auth);
    return NextResponse.json(await pingTradovate(auth));
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "Connection failed",
      },
      { status: 400 },
    );
  }
}
