import { NextRequest, NextResponse } from "next/server";
import { MatchType, OrderAction, OrderType } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MappingSchema = z.object({
  pattern: z.string().min(1),
  matchType: z.nativeEnum(MatchType).default(MatchType.CONTAINS),
  action: z.nativeEnum(OrderAction),
  quantity: z.number().int().positive().nullable().optional(),
  orderType: z.nativeEnum(OrderType).default(OrderType.MARKET),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mappings = await prisma.alertMapping.findMany({
    orderBy: [{ priority: "desc" }, { pattern: "asc" }],
  });
  return NextResponse.json({ mappings });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = MappingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mapping" }, { status: 400 });
  }

  const mapping = await prisma.alertMapping.create({ data: parsed.data });
  return NextResponse.json({ mapping }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = MappingSchema.partial()
    .extend({ id: z.string().min(1) })
    .safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mapping update" }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  const mapping = await prisma.alertMapping.update({ where: { id }, data });
  return NextResponse.json({ mapping });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await prisma.alertMapping.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
