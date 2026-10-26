"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";

type Account = {
  id: string;
  name: string;
  accountId: string;
  accountSpec: string;
  environment: string;
  enabled: boolean;
  isPrimary: boolean;
  quantityMultiplier: number;
  username: string | null;
  hasPassword: boolean;
};

type SymbolRow = {
  id: string;
  tradingViewSymbol: string;
  tradovateSymbol: string;
  orderType: string;
  defaultQty: number | null;
  minTick: number | null;
  lotSize: number | null;
  overrideMapping: boolean;
  enabled: boolean;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"accounts" | "symbols">("accounts");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [aRes, sRes] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/symbols"),
    ]);
    if (!aRes.ok || !sRes.ok) {
      setError("Failed to load accounts");
      return;
    }
    setAccounts((await aRes.json()).accounts);
    setSymbols((await sRes.json()).symbols);
    setError(null);
  }

  useEffect(() => {
    load();
  }, []);

  async function connectAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
        environment: form.get("environment"),
        name: String(form.get("name") || "") || null,
        isPrimary: form.get("isPrimary") === "on",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Connection failed");
      return;
    }
    formEl.reset();
    setMessage(data.message || "Account connected");
    await load();
  }

  async function testAccount(account: Account) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/accounts/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) {
      setError(data.message || "Connection failed");
      return;
    }
    setMessage(data.message || "Connected");
  }

  async function toggleAccount(account: Account, patch: Partial<Account>) {
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id, ...patch }),
    });
    await load();
  }

  async function removeAccount(id: string) {
    await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function addSymbol(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const res = await fetch("/api/symbols", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tradingViewSymbol: form.get("tradingViewSymbol"),
        tradovateSymbol: form.get("tradovateSymbol"),
        orderType: form.get("orderType") || "MARKET",
        defaultQty: form.get("defaultQty") ? Number(form.get("defaultQty")) : null,
        minTick: form.get("minTick") ? Number(form.get("minTick")) : null,
        lotSize: form.get("lotSize") ? Number(form.get("lotSize")) : null,
        overrideMapping: form.get("overrideMapping") === "on",
      }),
    });
    if (!res.ok) {
      setError("Failed to add symbol mapping");
      return;
    }
    formEl.reset();
    await load();
  }

  async function removeSymbol(id: string) {
    await fetch(`/api/symbols?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Accounts"
        description="Connect with your Tradovate username and password. Account ID and spec are fetched automatically."
        action={
          <div className="segmented">
            <button
              type="button"
              data-active={tab === "accounts"}
              onClick={() => setTab("accounts")}
            >
              Broker accounts
            </button>
            <button
              type="button"
              data-active={tab === "symbols"}
              onClick={() => setTab("symbols")}
            >
              Symbol mapping
            </button>
          </div>
        }
      />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}

      {tab === "accounts" ? (
        <>
          <Panel flush>
            <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Spec</th>
                  <th>Env</th>
                  <th>Login</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="!text-[var(--text-muted)]">
                      No accounts yet. Connect with your Tradovate username and password below.
                    </td>
                  </tr>
                ) : (
                  accounts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.name}
                        {a.isPrimary ? (
                          <span className="ml-2">
                            <StatusBadge label="PRIMARY" tone="ok" />
                          </span>
                        ) : null}
                      </td>
                      <td className="font-mono text-xs">{a.accountSpec}</td>
                      <td className="font-mono text-xs">{a.environment}</td>
                      <td className="font-mono text-xs">{a.username || "—"}</td>
                      <td>
                        <StatusBadge
                          label={a.enabled ? "ON" : "OFF"}
                          tone={a.enabled ? "ok" : "muted"}
                        />
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                            disabled={busy || !a.hasPassword}
                            onClick={() => testAccount(a)}
                          >
                            Test
                          </button>
                          {!a.isPrimary ? (
                            <button
                              type="button"
                              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                              onClick={() => toggleAccount(a, { isPrimary: true })}
                            >
                              Set primary
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                            onClick={() => toggleAccount(a, { enabled: !a.enabled })}
                          >
                            {a.enabled ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-[var(--danger)] hover:underline"
                            onClick={() => removeAccount(a.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </Panel>

          <Panel title="Connect Tradovate (Lucid)" className="max-w-xl">
          <form onSubmit={connectAccount} className="grid gap-3">
            <p className="text-xs text-[var(--text-muted)]">
              Use the username and password Tradovate gave you. SignalPipe logs in and imports every trading account on that login.
            </p>
            <input
              name="username"
              required
              autoComplete="username"
              placeholder="Username"
              className="field font-mono"
            />
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              className="field"
            />
            <div className="grid grid-cols-2 gap-3">
              <select name="environment" defaultValue="demo" className="field">
                <option value="demo">demo</option>
                <option value="live">live</option>
              </select>
              <input name="name" placeholder="Label (optional)" className="field" />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input name="isPrimary" type="checkbox" defaultChecked />
              Set first account as primary
            </label>
            <button type="submit" className="btn btn-primary w-fit" disabled={busy}>
              {busy ? "Connecting…" : "Connect"}
            </button>
          </form>
          </Panel>
        </>
      ) : (
        <>
          <Panel flush>
            <div className="overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>TradingView</th>
                  <th>Tradovate</th>
                  <th>Type</th>
                  <th>Tick / Lot</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {symbols.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="!text-[var(--text-muted)]">
                      No mappings. Example: MNQ1! → MNQH6
                    </td>
                  </tr>
                ) : (
                  symbols.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono">{s.tradingViewSymbol}</td>
                      <td className="font-mono">{s.tradovateSymbol}</td>
                      <td className="font-mono text-xs">{s.orderType}</td>
                      <td className="font-mono text-xs text-[var(--text-muted)]">
                        {s.minTick ?? "—"} / {s.lotSize ?? "—"}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="text-xs text-[var(--danger)] hover:underline"
                          onClick={() => removeSymbol(s.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </Panel>

          <Panel title="Create symbol mapping" className="max-w-xl">
          <form onSubmit={addSymbol} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <input name="tradingViewSymbol" required placeholder="MNQ1!" className="field font-mono" />
              <input name="tradovateSymbol" required placeholder="MNQH6" className="field font-mono" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select name="orderType" defaultValue="MARKET" className="field">
                <option value="MARKET">MARKET</option>
                <option value="LIMIT">LIMIT</option>
              </select>
              <input name="minTick" type="number" step="0.01" placeholder="Min tick" className="field" />
              <input name="lotSize" type="number" step="0.01" placeholder="Lot size" className="field" />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input name="overrideMapping" type="checkbox" />
              Override mapping (disables auto-rollover logic)
            </label>
            <button type="submit" className="btn btn-secondary w-fit">
              Add mapping
            </button>
          </form>
          </Panel>
        </>
      )}
    </div>
  );
}
