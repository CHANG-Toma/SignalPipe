"use client";

import { FormEvent, useEffect, useState } from "react";
import { KillSwitch } from "@/components/KillSwitch";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";

type Settings = {
  tradingMode: "dry-run" | "demo" | "live";
  tradovateEnv: "demo" | "live";
  defaultSymbol: string;
  defaultQty: number;
  killSwitch: boolean;
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
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
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
    formEl.reset();
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Webhook secret, trading mode, defaults, and legacy comment mappings."
      />

      <Panel title="Kill switch" className="max-w-xl">
        <KillSwitch
          initial={settings.killSwitch}
          onChange={(enabled) => setSettings({ ...settings, killSwitch: enabled })}
        />
      </Panel>

      <Panel title="Bridge" className="max-w-xl">
      <form onSubmit={saveSettings} className="grid gap-4">

        <Field label="Trading mode">
          <select
            value={settings.tradingMode}
            onChange={(e) =>
              setSettings({
                ...settings,
                tradingMode: e.target.value as Settings["tradingMode"],
              })
            }
            className="field"
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
            className="field"
          >
            <option value="demo">demo.tradovateapi.com</option>
            <option value="live">live.tradovateapi.com</option>
          </select>
        </Field>

        <Field label="Default symbol">
          <input
            value={settings.defaultSymbol}
            onChange={(e) => setSettings({ ...settings, defaultSymbol: e.target.value })}
            className="field font-mono"
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
            className="field font-mono"
          />
        </Field>

        <Field label={`Webhook secret (current: ${settings.webhookSecretMasked})`}>
          <input
            type="password"
            value={newSecret}
            onChange={(e) => setNewSecret(e.target.value)}
            className="field font-mono"
            placeholder="Leave blank to keep current"
            autoComplete="off"
          />
        </Field>

        {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <button type="submit" className="btn btn-primary w-fit">
          Save settings
        </button>
      </form>
      </Panel>

      <Panel title="Legacy alert mappings" flush>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[640px]">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Match</th>
                <th>Action</th>
                <th>Qty</th>
                <th>Priority</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono">{m.pattern}</td>
                  <td className="font-mono text-xs">{m.matchType}</td>
                  <td className="font-mono text-xs">{m.action}</td>
                  <td className="font-mono text-xs">{m.quantity ?? "default"}</td>
                  <td className="font-mono text-xs">{m.priority}</td>
                  <td className="text-right">
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
      </Panel>

      <Panel title="Add mapping" className="max-w-xl">
        <form onSubmit={addMapping} className="grid gap-3">
          <input
            name="pattern"
            required
            placeholder="buy 01"
            className="field font-mono"
          />
          <div className="grid grid-cols-2 gap-3">
            <select name="matchType" defaultValue="CONTAINS" className="field">
              <option value="CONTAINS">CONTAINS</option>
              <option value="EXACT">EXACT</option>
              <option value="REGEX">REGEX</option>
            </select>
            <select name="action" defaultValue="BUY" className="field">
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
              className="field"
            />
            <input name="priority" type="number" defaultValue={10} className="field" />
          </div>
          <button type="submit" className="btn btn-secondary w-fit">
            Add mapping
          </button>
        </form>
      </Panel>
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
