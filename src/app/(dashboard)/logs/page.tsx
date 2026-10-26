"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";

type LogItem = {
  id: string;
  receivedAt: string;
  message: string | null;
  symbol: string | null;
  parseStatus: string;
  parseError: string | null;
  ignoredReason: string | null;
  action: string | null;
  quantity: number | null;
  rawBody: string;
  orderAttempts: Array<{
    id: string;
    status: string;
    dryRun: boolean;
    errorMessage: string | null;
    tradovateOrderId: string | null;
  }>;
};

function parseTone(status: string) {
  if (status === "OK") return "ok" as const;
  if (status === "DUPLICATE" || status === "IGNORED") return "warn" as const;
  if (status === "FAILED") return "danger" as const;
  return "muted" as const;
}

export default function LogsPage() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<LogItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    params.set("take", "80");
    const res = await fetch(`/api/logs?${params}`);
    if (!res.ok) {
      setError("Failed to load logs");
      return;
    }
    const data = await res.json();
    setItems(data.items);
    setTotal(data.total);
    setError(null);
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    load();
  }

  async function clearLogs() {
    if (
      !window.confirm(
        `Clear all ${total} alert log${total === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setClearing(true);
    setError(null);
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear logs");
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear logs");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Alerts log"
        description={`${total} incoming alert${total === 1 ? "" : "s"} from TradingView.`}
        action={
          <button
            type="button"
            className="btn btn-danger"
            disabled={clearing || total === 0}
            onClick={clearLogs}
          >
            {clearing ? "Clearing…" : "Clear logs"}
          </button>
        }
      />

      <form onSubmit={onFilter} className="flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search message / symbol"
          className="field min-w-[200px] flex-1"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="field w-auto"
        >
          <option value="">All statuses</option>
          <option value="OK">OK</option>
          <option value="FAILED">FAILED</option>
          <option value="IGNORED">IGNORED</option>
          <option value="DUPLICATE">DUPLICATE</option>
        </select>
        <button type="submit" className="btn btn-secondary">
          Filter
        </button>
      </form>

      {error ? <p className="text-[var(--danger)]">{error}</p> : null}

      <Panel flush>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th>Time</th>
                <th>Message</th>
                <th>Symbol</th>
                <th>Parse</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const attempt = item.orderAttempts[0];
                return (
                  <tr
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(item)}
                  >
                    <td className="font-mono text-xs text-[var(--text-muted)]">
                      {new Date(item.receivedAt).toLocaleString()}
                    </td>
                    <td className="font-mono">{item.message ?? "—"}</td>
                    <td className="font-mono text-xs">{item.symbol ?? "—"}</td>
                    <td>
                      <StatusBadge label={item.parseStatus} tone={parseTone(item.parseStatus)} />
                    </td>
                    <td className="font-mono text-xs text-[var(--text-muted)]">
                      {attempt
                        ? `${attempt.status}${attempt.dryRun ? " (dry)" : ""}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {selected ? (
        <Panel
          title="Event detail"
          action={
            <button type="button" className="btn btn-ghost !py-1 text-xs" onClick={() => setSelected(null)}>
              Close
            </button>
          }
        >
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--text-muted)]">Action</dt>
              <dd className="font-mono">{selected.action ?? "—"} × {selected.quantity ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Error / ignored</dt>
              <dd className="font-mono text-[var(--danger)]">
                {selected.parseError || selected.ignoredReason || "—"}
              </dd>
            </div>
          </dl>
          {selected.orderAttempts.map((a) => (
            <p key={a.id} className="mt-2 font-mono text-xs text-[var(--text-muted)]">
              Attempt {a.status}
              {a.dryRun ? " dry-run" : ""}
              {a.tradovateOrderId ? ` · orderId ${a.tradovateOrderId}` : ""}
              {a.errorMessage ? ` · ${a.errorMessage}` : ""}
            </p>
          ))}
          <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-[var(--bg-muted)] p-3 font-mono text-xs text-[var(--text-muted)]">
            {safePretty(selected.rawBody)}
          </pre>
        </Panel>
      ) : null}
    </div>
  );
}

function safePretty(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
