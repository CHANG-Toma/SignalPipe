"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Logs</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {total} webhook event{total === 1 ? "" : "s"}
        </p>
      </div>

      <form onSubmit={onFilter} className="flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search message / symbol"
          className="min-w-[200px] flex-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="OK">OK</option>
          <option value="FAILED">FAILED</option>
          <option value="IGNORED">IGNORED</option>
          <option value="DUPLICATE">DUPLICATE</option>
        </select>
        <button
          type="submit"
          className="rounded border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-2 text-sm hover:border-[var(--accent)]"
        >
          Filter
        </button>
      </form>

      {error ? <p className="text-[var(--danger)]">{error}</p> : null}

      <div className="overflow-x-auto border border-[var(--border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[var(--bg-muted)] text-[var(--text-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Message</th>
              <th className="px-3 py-2 font-medium">Symbol</th>
              <th className="px-3 py-2 font-medium">Parse</th>
              <th className="px-3 py-2 font-medium">Order</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const attempt = item.orderAttempts[0];
              return (
                <tr
                  key={item.id}
                  className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--bg-muted)]/50"
                  onClick={() => setSelected(item)}
                >
                  <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
                    {new Date(item.receivedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono">{item.message ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{item.symbol ?? "—"}</td>
                  <td className="px-3 py-2">
                    <StatusBadge label={item.parseStatus} tone={parseTone(item.parseStatus)} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
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

      {selected ? (
        <div className="border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Event detail</h2>
            <button
              type="button"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
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
          <pre className="mt-4 max-h-64 overflow-auto rounded bg-[var(--bg)] p-3 font-mono text-xs text-[var(--text-muted)]">
            {safePretty(selected.rawBody)}
          </pre>
        </div>
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
