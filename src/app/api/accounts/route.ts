import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AccountSchema = z.object({
  name: z.string().min(1),
  accountId: z.string().min(1),
  accountSpec: z.string().min(1),
  environment: z.enum(["demo", "live"]).default("demo"),
  enabled: z.boolean().default(true),
  isPrimary: z.boolean().default(false),
  quantityMultiplier: z.number().positive().default(1),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.brokerAccount.findMany({
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = AccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account payload" }, { status: 400 });
  }

  if (parsed.data.isPrimary) {
    await prisma.brokerAccount.updateMany({ data: { isPrimary: false } });
  }

  const account = await prisma.brokerAccount.create({ data: parsed.data });
  return NextResponse.json({ account }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = AccountSchema.partial()
    .extend({ id: z.string().min(1) })
    .safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account update" }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  if (data.isPrimary) {
    await prisma.brokerAccount.updateMany({
      where: { id: { not: id } },
      data: { isPrimary: false },
    });
  }

  const account = await prisma.brokerAccount.update({ where: { id }, data });
  return NextResponse.json({ account });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.brokerAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
