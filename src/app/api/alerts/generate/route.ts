import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import {
  buildWebhookUrl,
  generateAlertPayload,
  stringifyAlertJson,
} from "@/modules/alert/generator";

const BodySchema = z.object({
  source: z.enum(["strategy", "indicator"]),
  symbol: z.string().default("{{ticker}}"),
  indicatorAction: z.enum(["buy", "sell", "close"]).optional(),
  quantity: z.union([z.number(), z.string()]).default(1),
  riskPercentage: z.number().min(0).default(0),
  orderType: z.enum(["MKT", "LMT"]).default("MKT"),
  exitMode: z.enum(["none", "attach", "multiple"]).default("none"),
  tp: z.number().optional(),
  percentageTp: z.number().optional(),
  dollarTp: z.number().optional(),
  sl: z.number().optional(),
  percentageSl: z.number().optional(),
  dollarSl: z.number().optional(),
  trail: z.number().optional(),
  trailStop: z.number().optional(),
  trailTrigger: z.number().optional(),
  trailFreq: z.number().optional(),
  breakeven: z.number().optional(),
  breakevenOffset: z.number().optional(),
  pyramid: z.boolean().default(false),
  sameDirectionIgnore: z.boolean().default(false),
  reverseOrderClose: z.boolean().default(true),
  primaryAccountId: z.string().min(1),
  extraAccounts: z
    .array(
      z.object({
        accountId: z.string().min(1),
        quantityMultiplier: z.number().positive().default(1),
      }),
    )
    .default([]),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const primary = await prisma.brokerAccount.findUnique({
    where: { id: input.primaryAccountId },
  });
  if (!primary || !primary.enabled) {
    return NextResponse.json(
      { error: "Primary account not found or disabled" },
      { status: 400 },
    );
  }

  const extras = [];
  for (const e of input.extraAccounts) {
    const acc = await prisma.brokerAccount.findUnique({ where: { id: e.accountId } });
    if (acc && acc.enabled && acc.id !== primary.id) {
      extras.push({ account: acc, quantityMultiplier: e.quantityMultiplier });
    }
  }

  const settings = await getAppSettings();
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    req.nextUrl.origin ||
    "http://localhost:3000";

  const payload = generateAlertPayload({
    ...input,
    token: settings.webhookSecret,
    primaryAccount: primary,
    extraAccounts: extras,
  });

  const json = stringifyAlertJson(payload);
  const webhookUrl = buildWebhookUrl(baseUrl, settings.webhookSecret);

  return NextResponse.json({
    json,
    payload,
    webhookUrl,
    tokenMasked: `${settings.webhookSecret.slice(0, 4)}…`,
    instructions: {
      message: "Paste JSON into TradingView Alert → Message (JSON only).",
      webhook: "Paste webhook URL into TradingView Alert → Notifications → Webhook URL.",
    },
  });
}
