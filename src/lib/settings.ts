import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const TradingModeSchema = z.enum(["dry-run", "demo", "live"]);
export type TradingMode = z.infer<typeof TradingModeSchema>;

export const TradovateEnvSchema = z.enum(["demo", "live"]);
export type TradovateEnv = z.infer<typeof TradovateEnvSchema>;

export const AppSettingsSchema = z.object({
  webhookSecret: z.string().min(8),
  tradingMode: TradingModeSchema,
  tradovateEnv: TradovateEnvSchema,
  defaultSymbol: z.string().min(1),
  defaultQty: z.coerce.number().int().positive(),
  killSwitch: z.boolean(),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

const KEYS = [
  "webhookSecret",
  "tradingMode",
  "tradovateEnv",
  "defaultSymbol",
  "defaultQty",
  "killSwitch",
] as const;

function coerceValue(key: string, raw: string): unknown {
  if (key === "killSwitch") return raw === "true" || raw === "1";
  if (key === "defaultQty") return Number(raw);
  return raw;
}

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [...KEYS] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, coerceValue(r.key, r.value)]));

  return AppSettingsSchema.parse({
    webhookSecret: map.webhookSecret ?? process.env.WEBHOOK_SECRET ?? "change-me-webhook-secret",
    tradingMode: map.tradingMode ?? process.env.TRADING_MODE ?? "dry-run",
    tradovateEnv: map.tradovateEnv ?? process.env.TRADOVATE_ENV ?? "demo",
    defaultSymbol: map.defaultSymbol ?? process.env.DEFAULT_SYMBOL ?? "MNQH5",
    defaultQty: map.defaultQty ?? Number(process.env.DEFAULT_QTY ?? "1"),
    killSwitch: map.killSwitch ?? false,
  });
}

export async function setSetting(key: string, value: string | number | boolean) {
  const serialized = String(value);
  await prisma.setting.upsert({
    where: { key },
    update: { value: serialized },
    create: { key, value: serialized },
  });
}

export async function updateAppSettings(partial: Partial<AppSettings>) {
  const entries = Object.entries(partial).filter(([, v]) => v !== undefined);
  for (const [key, value] of entries) {
    await setSetting(key, value as string | number | boolean);
  }
  return getAppSettings();
}
