import { NextRequest, NextResponse } from "next/server";
import { ParseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getAppSettings } from "@/lib/settings";
import { buildIdempotencyKey } from "@/modules/webhook/idempotency";
import { isParsedAlert, parseWebhook } from "@/modules/webhook/parser";
import { routeOrder } from "@/modules/order/router";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ secret: string }> },
) {
  const { secret } = await context.params;
  const ip = clientIp(req);
  const rl = rateLimit(`webhook:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const settings = await getAppSettings();
  const headerSecret = req.headers.get("x-webhook-secret");
  const provided = secret || headerSecret || "";
  if (!provided || provided !== settings.webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: string;
  let json: unknown;
  try {
    rawBody = await req.text();
    json = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    const event = await prisma.webhookEvent.create({
      data: {
        rawBody: "",
        parseStatus: ParseStatus.FAILED,
        parseError: "Invalid JSON body",
      },
    });
    return NextResponse.json(
      { ok: false, eventId: event.id, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const mappings = await prisma.alertMapping.findMany({
    orderBy: { priority: "desc" },
  });
  const result = parseWebhook(json, mappings);
  const message = result.message;
  const symbol = result.symbol;
  const strategyOrderId = result.strategyOrderId;
  const idempotencyKey = buildIdempotencyKey({
    strategyOrderId,
    message,
    symbol,
  });

  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    await prisma.webhookEvent.create({
      data: {
        rawBody,
        headersJson: JSON.stringify({
          "user-agent": req.headers.get("user-agent"),
        }),
        symbol,
        message,
        strategyOrderId,
        parseStatus: ParseStatus.DUPLICATE,
        idempotencyKey: `${idempotencyKey}:dup:${Date.now()}`,
        ignoredReason: `Duplicate of ${existing.id}`,
        action: existing.action,
        quantity: existing.quantity,
      },
    });
    return NextResponse.json({
      ok: true,
      duplicate: true,
      originalEventId: existing.id,
    });
  }

  if (!isParsedAlert(result)) {
    const event = await prisma.webhookEvent.create({
      data: {
        rawBody,
        headersJson: JSON.stringify({
          "user-agent": req.headers.get("user-agent"),
        }),
        symbol,
        message,
        strategyOrderId,
        parseStatus: ParseStatus.FAILED,
        parseError: result.error,
        idempotencyKey,
      },
    });
    return NextResponse.json(
      { ok: false, eventId: event.id, error: result.error },
      { status: 422 },
    );
  }

  if (settings.killSwitch) {
    const event = await prisma.webhookEvent.create({
      data: {
        rawBody,
        headersJson: JSON.stringify({
          "user-agent": req.headers.get("user-agent"),
        }),
        symbol,
        message,
        strategyOrderId,
        parseStatus: ParseStatus.IGNORED,
        ignoredReason: "Kill switch active",
        idempotencyKey,
        action: result.action,
        quantity: result.quantity ?? settings.defaultQty,
      },
    });
    await routeOrder(event.id, result, settings);
    return NextResponse.json({
      ok: true,
      eventId: event.id,
      ignored: true,
      reason: "kill-switch",
    });
  }

  const event = await prisma.webhookEvent.create({
    data: {
      rawBody,
      headersJson: JSON.stringify({
        "user-agent": req.headers.get("user-agent"),
      }),
      symbol,
      message,
      strategyOrderId,
      parseStatus: ParseStatus.OK,
      idempotencyKey,
      action: result.action,
      quantity: result.quantity ?? settings.defaultQty,
    },
  });

  const route = await routeOrder(event.id, result, settings);

  return NextResponse.json({
    ok: true,
    eventId: event.id,
    action: result.action,
    dryRun: route.dryRun,
    orderStatus: route.status,
    attemptId: route.attemptId,
    error: route.errorMessage,
  });
}
