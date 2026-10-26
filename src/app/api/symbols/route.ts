import { NextRequest, NextResponse } from "next/server";
import { OrderType } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SymbolSchema = z.object({
  tradingViewSymbol: z.string().min(1),
  tradovateSymbol: z.string().min(1),
  orderType: z.nativeEnum(OrderType).default(OrderType.MARKET),
  defaultQty: z.number().int().positive().nullable().optional(),
  minTick: z.number().positive().nullable().optional(),
  lotSize: z.number().positive().nullable().optional(),
  overrideMapping: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const symbols = await prisma.symbolMapping.findMany({
    orderBy: { tradingViewSymbol: "asc" },
  });
  return NextResponse.json({ symbols });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = SymbolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid symbol mapping" }, { status: 400 });
  }

  const symbol = await prisma.symbolMapping.create({ data: parsed.data });
  return NextResponse.json({ symbol }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = SymbolSchema.partial()
    .extend({ id: z.string().min(1) })
    .safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid symbol update" }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  const symbol = await prisma.symbolMapping.update({ where: { id }, data });
  return NextResponse.json({ symbol });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.symbolMapping.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
