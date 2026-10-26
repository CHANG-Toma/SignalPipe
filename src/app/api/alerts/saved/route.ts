import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SaveSchema = z.object({
  name: z.string().min(1),
  source: z.enum(["strategy", "indicator"]),
  configJson: z.string().min(2),
  alertJson: z.string().min(2),
  webhookUrl: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await prisma.savedAlert.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid saved alert" }, { status: 400 });
  }

  const alert = await prisma.savedAlert.create({ data: parsed.data });
  return NextResponse.json({ alert }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.savedAlert.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
