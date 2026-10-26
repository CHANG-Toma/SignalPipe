"use client";

import { useEffect, useState } from "react";
import { KillSwitch } from "@/components/KillSwitch";
import { StatusBadge } from "@/components/StatusBadge";

type OverviewData = {
  settings: {
    tradingMode: string;
    tradovateEnv: string;
    killSwitch: boolean;
    defaultSymbol: string;
    defaultQty: number;
  };
  tradovate: { ok: boolean; message: string };
  counters: { ordersToday: number; failedToday: number };
  recentEvents: Array<{
    id: string;
    receivedAt: string;
    message: string | null;
    parseStatus: string;
    action: string | null;
    orderAttempts: Array<{ status: string; dryRun: boolean }>;
  }>;
};

function parseTone(status: string) {
  if (status === "OK") return "ok" as const;
  if (status === "DUPLICATE" || status === "IGNORED") return "warn" as const;
  if (status === "FAILED") return "danger" as const;
  return "muted" as const;
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/overview");
      if (!res.ok) throw new Error("Failed to load overview");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  if (error) {
    return <p className="text-[var(--danger)]">{error}</p>;
  }

  if (!data) {
    return <p className="text-[var(--text-muted)]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Live bridge status and recent webhook activity
          </p>
        </div>
        <KillSwitch initial={data.settings.killSwitch} onChange={() => load()} />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Mode" value={data.settings.tradingMode} />
        <Stat label="Tradovate" value={data.settings.tradovateEnv} />
        <Stat label="Orders today" value={String(data.counters.ordersToday)} />
        <Stat label="Failures today" value={String(data.counters.failedToday)} />
      </section>

      <section className="border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">API connection</h2>
          <StatusBadge
            label={data.tradovate.ok ? "OK" : "DOWN"}
            tone={data.tradovate.ok ? "ok" : "danger"}
          />
        </div>
        <p className="font-mono text-sm text-[var(--text-muted)]">{data.tradovate.message}</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Symbol {data.settings.defaultSymbol} · qty {data.settings.defaultQty}
          {data.settings.killSwitch ? " · trading paused" : ""}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Recent events</h2>
        <div className="overflow-x-auto border border-[var(--border)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[var(--bg-muted)] text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Message</th>
                <th className="px-3 py-2 font-medium">Parse</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Order</th>
              </tr>
            </thead>
            <tbody>
              {data.recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-[var(--text-muted)]">
                    No webhooks yet. Send a test alert to see events here.
                  </td>
                </tr>
              ) : (
                data.recentEvents.map((ev) => {
                  const attempt = ev.orderAttempts[0];
                  return (
                    <tr key={ev.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
                        {new Date(ev.receivedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono">{ev.message ?? "—"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge label={ev.parseStatus} tone={parseTone(ev.parseStatus)} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{ev.action ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
                        {attempt
                          ? `${attempt.status}${attempt.dryRun ? " (dry)" : ""}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <p className="text-xs tracking-wide text-[var(--text-muted)] uppercase">{label}</p>
      <p className="mt-2 font-mono text-lg">{value}</p>
    </div>
  );
}
