import { NextRequest } from "next/server";
import { handleWebhook } from "@/lib/webhook-handler";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ secret: string }> },
) {
  const { secret } = await context.params;
  return handleWebhook(req, secret);
}
