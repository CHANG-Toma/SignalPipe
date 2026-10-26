import { NextRequest, NextResponse } from "next/server";
import { ParseStatus } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const QuerySchema = z.object({
  status: z.nativeEnum(ParseStatus).optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { status, q, take, skip } = parsed.data;
  const where = {
    ...(status ? { parseStatus: status } : {}),
    ...(q
      ? {
          OR: [
            { message: { contains: q, mode: "insensitive" as const } },
            { symbol: { contains: q, mode: "insensitive" as const } },
            { parseError: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.webhookEvent.findMany({
      where,
      take,
      skip,
      orderBy: { receivedAt: "desc" },
      include: { orderAttempts: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.webhookEvent.count({ where }),
  ]);

  return NextResponse.json({ items, total, take, skip });
}

/** Clear all webhook events (+ cascaded order attempts). */
export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.webhookEvent.deleteMany({});
  return NextResponse.json({ ok: true, deleted: result.count });
}
