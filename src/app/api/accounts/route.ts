import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secrets";
import { clearTokenCache } from "@/modules/tradovate/auth";
import { listAccounts, pingTradovate } from "@/modules/tradovate/client";

const ConnectSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  environment: z.enum(["demo", "live"]).default("demo"),
  /** Optional label prefix; defaults to Tradovate account name */
  name: z.string().optional().nullable(),
  isPrimary: z.boolean().default(true),
});

const PatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  quantityMultiplier: z.number().positive().optional(),
  password: z.string().min(1).optional(),
});

function toPublicAccount<T extends { passwordEnc?: string | null }>(account: T) {
  const { passwordEnc, ...rest } = account;
  return {
    ...rest,
    hasPassword: Boolean(passwordEnc),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.brokerAccount.findMany({
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ accounts: accounts.map(toPublicAccount) });
}

/** Connect with Lucid username/password — discovers Tradovate accounts via API */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = ConnectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const { username, password, environment, name, isPrimary } = parsed.data;
  const auth = { env: environment, username, password };

  const ping = await pingTradovate(auth);
  if (!ping.ok) {
    return NextResponse.json({ error: ping.message }, { status: 400 });
  }

  const discovered = ping.accounts?.length
    ? ping.accounts
    : await listAccounts(auth);

  if (discovered.length === 0) {
    return NextResponse.json(
      { error: "Login OK but no Tradovate accounts found on this login" },
      { status: 400 },
    );
  }

  const passwordEnc = encryptSecret(password);
  clearTokenCache(username);

  if (isPrimary) {
    await prisma.brokerAccount.updateMany({ data: { isPrimary: false } });
  }

  const existingPrimary = await prisma.brokerAccount.findFirst({
    where: { isPrimary: true },
  });

  const saved = [];
  for (let i = 0; i < discovered.length; i++) {
    const tv = discovered[i];
    const accountId = String(tv.id);
    const accountSpec = tv.name;
    const displayName = name?.trim()
      ? discovered.length === 1
        ? name.trim()
        : `${name.trim()} · ${accountSpec}`
      : accountSpec;

    const makePrimary = isPrimary ? i === 0 : !existingPrimary && i === 0;

    const account = await prisma.brokerAccount.upsert({
      where: { accountId },
      update: {
        name: displayName,
        accountSpec,
        environment,
        username,
        passwordEnc,
        enabled: true,
        ...(makePrimary ? { isPrimary: true } : {}),
      },
      create: {
        name: displayName,
        accountId,
        accountSpec,
        environment,
        username,
        passwordEnc,
        isPrimary: makePrimary,
        enabled: true,
      },
    });
    saved.push(toPublicAccount(account));
  }

  return NextResponse.json(
    {
      accounts: saved,
      message: `Connected ${saved.length} account${saved.length === 1 ? "" : "s"} from ${username}`,
    },
    { status: 201 },
  );
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account update" }, { status: 400 });
  }

  const { id, password, ...rest } = parsed.data;
  if (rest.isPrimary) {
    await prisma.brokerAccount.updateMany({
      where: { id: { not: id } },
      data: { isPrimary: false },
    });
  }

  const data: Record<string, unknown> = { ...rest };
  if (password) {
    data.passwordEnc = encryptSecret(password);
    const current = await prisma.brokerAccount.findUnique({ where: { id } });
    if (current?.username) clearTokenCache(current.username);
  }

  const account = await prisma.brokerAccount.update({ where: { id }, data });
  return NextResponse.json({ account: toPublicAccount(account) });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.brokerAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
