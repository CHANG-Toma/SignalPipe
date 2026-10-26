"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KillSwitch } from "@/components/KillSwitch";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
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

  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!data) return <p className="text-[var(--text-muted)]">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="Bridge health, today’s orders, and the latest TradingView alerts."
        action={
          <KillSwitch initial={data.settings.killSwitch} onChange={() => load()} />
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Mode" value={data.settings.tradingMode} />
        <Stat label="Tradovate" value={data.settings.tradovateEnv} />
        <Stat label="Orders today" value={String(data.counters.ordersToday)} />
        <Stat label="Failures today" value={String(data.counters.failedToday)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="API connection">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm text-[var(--text-muted)]">
                {data.tradovate.message}
              </p>
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Symbol{" "}
                <span className="font-mono text-[var(--text)]">
                  {data.settings.defaultSymbol}
                </span>{" "}
                · qty{" "}
                <span className="font-mono text-[var(--text)]">
                  {data.settings.defaultQty}
                </span>
                {data.settings.killSwitch ? " · trading paused" : ""}
              </p>
            </div>
            <StatusBadge
              label={data.tradovate.ok ? "OK" : "DOWN"}
              tone={data.tradovate.ok ? "ok" : "danger"}
            />
          </div>
        </Panel>

        <Panel title="Next steps">
          <ol className="space-y-3 text-sm text-[var(--text-muted)]">
            <li>
              <Link href="/accounts" className="font-medium text-[var(--accent)] hover:underline">
                Connect accounts
              </Link>{" "}
              and map symbols
            </li>
            <li>
              <Link href="/alerts" className="font-medium text-[var(--accent)] hover:underline">
                Generate alert
              </Link>{" "}
              JSON for TradingView
            </li>
            <li>
              Watch results in the{" "}
              <Link href="/logs" className="font-medium text-[var(--accent)] hover:underline">
                alerts log
              </Link>
            </li>
          </ol>
        </Panel>
      </div>

      <Panel
        title="Recent events"
        flush
        action={
          <Link href="/logs" className="text-xs font-medium text-[var(--accent)] hover:underline">
            View all
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="data-table min-w-[640px]">
            <thead>
              <tr>
                <th>Time</th>
                <th>Message</th>
                <th>Parse</th>
                <th>Action</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {data.recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="!text-[var(--text-muted)]">
                    No webhooks yet. Generate an alert and send a test from TradingView.
                  </td>
                </tr>
              ) : (
                data.recentEvents.map((ev) => {
                  const attempt = ev.orderAttempts[0];
                  return (
                    <tr key={ev.id}>
                      <td className="font-mono text-xs text-[var(--text-muted)]">
                        {new Date(ev.receivedAt).toLocaleString()}
                      </td>
                      <td className="font-mono">{ev.message ?? "—"}</td>
                      <td>
                        <StatusBadge label={ev.parseStatus} tone={parseTone(ev.parseStatus)} />
                      </td>
                      <td className="font-mono text-xs">{ev.action ?? "—"}</td>
                      <td className="font-mono text-xs text-[var(--text-muted)]">
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
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--text-muted)] uppercase">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
