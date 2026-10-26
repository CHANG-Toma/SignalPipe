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
  notes: string | null;
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
  const [tab, setTab] = useState<"accounts" | "symbols">("accounts");

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

  async function addAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        accountId: form.get("accountId"),
        accountSpec: form.get("accountSpec"),
        environment: form.get("environment"),
        isPrimary: form.get("isPrimary") === "on",
        quantityMultiplier: Number(form.get("quantityMultiplier") || 1),
        notes: String(form.get("notes") || "") || null,
      }),
    });
    if (!res.ok) {
      setError("Failed to add account");
      return;
    }
    e.currentTarget.reset();
    await load();
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
    const form = new FormData(e.currentTarget);
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
    e.currentTarget.reset();
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
        description="Link Tradovate accounts and map TradingView symbols to contracts."
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

      {tab === "accounts" ? (
        <>
          <Panel flush>
            <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Account ID</th>
                  <th>Spec</th>
                  <th>Env</th>
                  <th>Mult</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="!text-[var(--text-muted)]">
                      No accounts yet. Add your Tradovate demo account below.
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
                      <td className="font-mono text-xs">{a.accountId}</td>
                      <td className="font-mono text-xs">{a.accountSpec}</td>
                      <td className="font-mono text-xs">{a.environment}</td>
                      <td className="font-mono text-xs">{a.quantityMultiplier}</td>
                      <td>
                        <StatusBadge
                          label={a.enabled ? "ON" : "OFF"}
                          tone={a.enabled ? "ok" : "muted"}
                        />
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
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

          <Panel title="Add Tradovate account" className="max-w-xl">
          <form onSubmit={addAccount} className="grid gap-3">
            <input name="name" required placeholder="Display name (e.g. Demo MNQ)" className="field" />
            <div className="grid grid-cols-2 gap-3">
              <input name="accountId" required placeholder="Account ID (numeric)" className="field font-mono" />
              <input name="accountSpec" required placeholder="Account spec (DEMO…)" className="field font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select name="environment" defaultValue="demo" className="field">
                <option value="demo">demo</option>
                <option value="live">live</option>
              </select>
              <input
                name="quantityMultiplier"
                type="number"
                step="0.1"
                min={0.1}
                defaultValue={1}
                placeholder="Qty multiplier"
                className="field"
              />
            </div>
            <input name="notes" placeholder="Notes (optional)" className="field" />
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input name="isPrimary" type="checkbox" />
              Set as primary account
            </label>
            <button type="submit" className="btn btn-primary w-fit">
              Add account
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
