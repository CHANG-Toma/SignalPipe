import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { maskSecret } from "@/lib/env";
import {
  AppSettingsSchema,
  getAppSettings,
  updateAppSettings,
} from "@/lib/settings";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getAppSettings();
  return NextResponse.json({
    ...settings,
    webhookSecretMasked: maskSecret(settings.webhookSecret),
    webhookSecret: undefined,
  });
}

const UpdateSchema = AppSettingsSchema.partial().extend({
  webhookSecret: z.string().min(8).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const updated = await updateAppSettings(parsed.data);
  return NextResponse.json({
    ...updated,
    webhookSecretMasked: maskSecret(updated.webhookSecret),
    webhookSecret: undefined,
  });
}
