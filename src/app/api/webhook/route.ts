import { NextRequest } from "next/server";
import { handleWebhook } from "@/lib/webhook-handler";

export const runtime = "nodejs";

/** Auth via JSON `token` field (optional URL secret alternative). */
export async function POST(req: NextRequest) {
  return handleWebhook(req);
}
