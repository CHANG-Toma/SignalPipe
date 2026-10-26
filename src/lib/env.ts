import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),
  TRADOVATE_ENV: z.enum(["demo", "live"]).default("demo"),
  /** Tradovate API app key (Application Settings → API Access) */
  TRADOVATE_CID: z.string().optional(),
  TRADOVATE_SEC: z.string().optional(),
  TRADING_MODE: z.enum(["dry-run", "demo", "live"]).default("dry-run"),
  DEFAULT_SYMBOL: z.string().optional(),
  DEFAULT_QTY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }
  cached = parsed.data;
  return cached;
}

export function maskSecret(value: string | null | undefined, visible = 4): string {
  if (!value) return "";
  if (value.length <= visible) return "••••";
  return `${value.slice(0, visible)}…${"•".repeat(Math.min(8, value.length - visible))}`;
}
