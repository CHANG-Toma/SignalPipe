import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getAppSettings, setSetting } from "@/lib/settings";

const BodySchema = z.object({
  enabled: z.boolean(),
});

export async function POST(req: NextRequest) {
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "enabled boolean required" }, { status: 400 });
  }

  await setSetting("killSwitch", parsed.data.enabled);
  const settings = await getAppSettings();
  return NextResponse.json({ killSwitch: settings.killSwitch });
}
