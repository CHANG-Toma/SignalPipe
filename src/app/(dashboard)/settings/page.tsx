"use client";

import { FormEvent, useEffect, useState } from "react";
import { KillSwitch } from "@/components/KillSwitch";

const fieldClass =
  "w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

type Settings = {
  tradingMode: "dry-run" | "demo" | "live";
  tradovateEnv: "demo" | "live";
  defaultSymbol: string;
  defaultQty: number;
  killSwitch: boolean;
  accountId: string;
  accountSpec: string;
  webhookSecretMasked: string;
};

type Mapping = {
  id: string;
  pattern: string;
  matchType: string;
  action: string;
  quantity: number | null;
  orderType: string;
  enabled: boolean;
  priority: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState("");

  async function load() {
    const [sRes, mRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/mappings"),
    ]);
    if (!sRes.ok || !mRes.ok) {
      setError("Failed to load settings");
      return;
    }
    setSettings(await sRes.json());
    const m = await mRes.json();
    setMappings(m.mappings);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) return;
    setMessage(null);
    setError(null);
    const payload: Record<string, unknown> = {
      tradingMode: settings.tradingMode,
      tradovateEnv: settings.tradovateEnv,
      defaultSymbol: settings.defaultSymbol,
      defaultQty: settings.defaultQty,
      accountId: settings.accountId,
      accountSpec: settings.accountSpec,
    };
    if (newSecret.trim()) payload.webhookSecret = newSecret.trim();

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Save failed");
      return;
    }
    setSettings(await res.json());
    setNewSecret("");
    setMessage("Settings saved");
  }

  async function addMapping(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern: form.get("pattern"),
        matchType: form.get("matchType"),
        action: form.get("action"),
        quantity: form.get("quantity") ? Number(form.get("quantity")) : null,
        priority: Number(form.get("priority") || 0),
      }),
    });
    if (!res.ok) {
      setError("Failed to add mapping");
      return;
    }
    e.currentTarget.reset();
    await load();
  }

  async function removeMapping(id: string) {
    await fetch(`/api/mappings?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (!settings) {
    return <p className="text-[var(--text-muted)]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Webhook secret, trading mode, symbol, and alert mappings
        </p>
      </div>

      <section className="max-w-xl">
        <h2 className="mb-3 text-sm font-medium">Kill switch</h2>
        <KillSwitch
          initial={settings.killSwitch}
          onChange={(enabled) => setSettings({ ...settings, killSwitch: enabled })}
        />
      </section>

      <form onSubmit={saveSettings} className="grid max-w-xl gap-4">
        <h2 className="text-sm font-medium">Bridge</h2>

        <Field label="Trading mode">
          <select
            value={settings.tradingMode}
            onChange={(e) =>
              setSettings({
                ...settings,
                tradingMode: e.target.value as Settings["tradingMode"],
              })
            }
            className={fieldClass}
          >
            <option value="dry-run">dry-run (parse + log only)</option>
            <option value="demo">demo (send to Tradovate demo)</option>
            <option value="live">live (real money — careful)</option>
          </select>
        </Field>

        <Field label="Tradovate environment">
          <select
            value={settings.tradovateEnv}
            onChange={(e) =>
              setSettings({
                ...settings,
                tradovateEnv: e.target.value as Settings["tradovateEnv"],
              })
            }
            className={fieldClass}
          >
            <option value="demo">demo.tradovateapi.com</option>
            <option value="live">live.tradovateapi.com</option>
          </select>
        </Field>

        <Field label="Default symbol">
          <input
            value={settings.defaultSymbol}
            onChange={(e) => setSettings({ ...settings, defaultSymbol: e.target.value })}
            className={`${fieldClass} font-mono`}
          />
        </Field>

        <Field label="Default quantity">
          <input
            type="number"
            min={1}
            value={settings.defaultQty}
            onChange={(e) =>
              setSettings({ ...settings, defaultQty: Number(e.target.value) })
            }
            className={`${fieldClass} font-mono`}
          />
        </Field>

        <Field label="Account ID">
          <input
            value={settings.accountId}
            onChange={(e) => setSettings({ ...settings, accountId: e.target.value })}
            className={`${fieldClass} font-mono`}
            placeholder="Tradovate numeric accountId"
          />
        </Field>

        <Field label="Account spec">
          <input
            value={settings.accountSpec}
            onChange={(e) => setSettings({ ...settings, accountSpec: e.target.value })}
            className={`${fieldClass} font-mono`}
            placeholder="e.g. DEMO1234567"
          />
        </Field>

        <Field label={`Webhook secret (current: ${settings.webhookSecretMasked})`}>
          <input
            type="password"
            value={newSecret}
            onChange={(e) => setNewSecret(e.target.value)}
            className={`${fieldClass} font-mono`}
            placeholder="Leave blank to keep current"
            autoComplete="off"
          />
        </Field>

        {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <button
          type="submit"
          className="w-fit rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[#07140e]"
        >
          Save settings
        </button>
      </form>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium">Alert mappings</h2>
        <div className="overflow-x-auto border border-[var(--border)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[var(--bg-muted)] text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Pattern</th>
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-mono">{m.pattern}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.matchType}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.action}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.quantity ?? "default"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{m.priority}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeMapping(m.id)}
                      className="text-xs text-[var(--danger)] hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          onSubmit={addMapping}
          className="grid max-w-xl gap-3 border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
        >
          <p className="text-sm text-[var(--text-muted)]">Add mapping</p>
          <input
            name="pattern"
            required
            placeholder="buy 01"
            className={`${fieldClass} font-mono`}
          />
          <div className="grid grid-cols-2 gap-3">
            <select name="matchType" defaultValue="CONTAINS" className={fieldClass}>
              <option value="CONTAINS">CONTAINS</option>
              <option value="EXACT">EXACT</option>
              <option value="REGEX">REGEX</option>
            </select>
            <select name="action" defaultValue="BUY" className={fieldClass}>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="FLATTEN">FLATTEN</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="quantity"
              type="number"
              min={1}
              placeholder="qty (optional)"
              className={fieldClass}
            />
            <input name="priority" type="number" defaultValue={10} className={fieldClass} />
          </div>
          <button
            type="submit"
            className="w-fit rounded border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-2 text-sm"
          >
            Add mapping
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}
