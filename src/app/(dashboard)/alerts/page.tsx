"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";

type Account = {
  id: string;
  name: string;
  accountId: string;
  accountSpec: string;
  enabled: boolean;
  isPrimary: boolean;
  quantityMultiplier: number;
};

type SavedAlert = {
  id: string;
  name: string;
  source: string;
  alertJson: string;
  webhookUrl: string | null;
  updatedAt: string;
};

export default function AlertsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saved, setSaved] = useState<SavedAlert[]>([]);
  const [primaryId, setPrimaryId] = useState("");
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [json, setJson] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [lastConfig, setLastConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"json" | "url" | null>(null);
  const [source, setSource] = useState<"strategy" | "indicator">("strategy");
  const [exitMode, setExitMode] = useState<"none" | "attach" | "multiple">("none");
  const [saveName, setSaveName] = useState("");

  async function load() {
    const [aRes, sRes] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/alerts/saved"),
    ]);
    if (aRes.ok) {
      const list = ((await aRes.json()).accounts as Account[]).filter((a) => a.enabled);
      setAccounts(list);
      const primary = list.find((a) => a.isPrimary) || list[0];
      if (primary) setPrimaryId(primary.id);
    }
    if (sRes.ok) {
      setSaved((await sRes.json()).alerts);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function buildBody(form: FormData) {
    return {
      source,
      symbol: form.get("symbol") || "{{ticker}}",
      indicatorAction: form.get("indicatorAction") || "buy",
      quantity:
        source === "strategy"
          ? "{{strategy.order.contracts}}"
          : Number(form.get("quantity") || 1),
      riskPercentage: Number(form.get("riskPercentage") || 0),
      orderType: form.get("orderType") || "MKT",
      exitMode,
      tp: Number(form.get("tp") || 0),
      sl: Number(form.get("sl") || 0),
      dollarTp: Number(form.get("dollarTp") || 0),
      dollarSl: Number(form.get("dollarSl") || 0),
      percentageTp: Number(form.get("percentageTp") || 0),
      percentageSl: Number(form.get("percentageSl") || 0),
      trail: Number(form.get("trail") || 0),
      trailStop: Number(form.get("trailStop") || 0),
      trailTrigger: Number(form.get("trailTrigger") || 0),
      trailFreq: Number(form.get("trailFreq") || 0),
      breakeven: Number(form.get("breakeven") || 0),
      breakevenOffset: Number(form.get("breakevenOffset") || 0),
      pyramid: form.get("pyramid") === "on",
      sameDirectionIgnore: form.get("sameDirectionIgnore") === "on",
      reverseOrderClose: form.get("reverseOrderClose") === "on",
      primaryAccountId: primaryId,
      extraAccounts: extraIds.map((id) => {
        const acc = accounts.find((a) => a.id === id);
        return {
          accountId: id,
          quantityMultiplier: acc?.quantityMultiplier ?? 1,
        };
      }),
    };
  }

  async function onGenerate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCopied(null);

    if (!primaryId) {
      setError("Add a Tradovate account in Accounts first");
      return;
    }

    const form = new FormData(e.currentTarget);
    const body = buildBody(form);
    setLastConfig(body);

    const res = await fetch("/api/alerts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Generate failed");
      return;
    }

    const data = await res.json();
    setJson(data.json);
    setWebhookUrl(data.webhookUrl);
  }

  async function saveAlert() {
    if (!json || !lastConfig) return;
    const name = saveName.trim() || `${source} ${new Date().toLocaleString()}`;
    const res = await fetch("/api/alerts/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        source,
        configJson: JSON.stringify(lastConfig),
        alertJson: json,
        webhookUrl,
      }),
    });
    if (!res.ok) {
      setError("Failed to save alert");
      return;
    }
    setSaveName("");
    await load();
  }

  async function deleteSaved(id: string) {
    await fetch(`/api/alerts/saved?id=${id}`, { method: "DELETE" });
    await load();
  }

  function loadSaved(alert: SavedAlert) {
    setJson(alert.alertJson);
    setWebhookUrl(alert.webhookUrl || "");
    setSource(alert.source === "indicator" ? "indicator" : "strategy");
  }

  async function copy(kind: "json" | "url") {
    const text = kind === "json" ? json : webhookUrl;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
  }

  function toggleExtra(id: string) {
    setExtraIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div>
      <PageHeader
        title="Generate alert"
        description="Signal → exits → accounts → copy JSON and webhook into TradingView."
      />

      <form onSubmit={onGenerate} className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Panel>
            <div className="step-rail">
              <span>Step 01</span>
              <h2 className="text-sm font-semibold">Signal source</h2>
            </div>
            <div className="segmented">
              {(["strategy", "indicator"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  data-active={source === s}
                  onClick={() => setSource(s)}
                  className="capitalize"
                >
                  {s}
                </button>
              ))}
            </div>
            <label className="mt-4 flex flex-col gap-1.5 text-sm">
              <span className="text-[var(--text-muted)]">Symbol</span>
              <input
                name="symbol"
                defaultValue="{{ticker}}"
                placeholder="MNQ1! or {{ticker}}"
                className="field font-mono"
              />
            </label>
            {source === "indicator" ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-[var(--text-muted)]">Action</span>
                  <select name="indicatorAction" defaultValue="buy" className="field">
                    <option value="buy">buy</option>
                    <option value="sell">sell</option>
                    <option value="close">close</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-[var(--text-muted)]">Quantity</span>
                  <input name="quantity" type="number" min={1} defaultValue={1} className="field" />
                </label>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Uses {"{{strategy.order.action}}"} and {"{{strategy.order.contracts}}"}.
              </p>
            )}
          </Panel>

          <Panel>
            <div className="step-rail">
              <span>Step 02</span>
              <h2 className="text-sm font-semibold">Exit management</h2>
            </div>
            <div className="segmented mb-4 flex-wrap">
              {(
                [
                  ["none", "No SL/TP"],
                  ["attach", "Attach SL/TP"],
                  ["multiple", "Multiple exits"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  data-active={exitMode === id}
                  onClick={() => setExitMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--text-muted)]">Order type</span>
                <select name="orderType" defaultValue="MKT" className="field">
                  <option value="MKT">MKT</option>
                  <option value="LMT">LMT</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--text-muted)]">Risk %</span>
                <input name="riskPercentage" type="number" min={0} step="0.1" defaultValue={0} className="field" />
              </label>
            </div>
            {exitMode !== "none" ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input name="sl" type="number" step="0.01" placeholder="SL (points)" className="field" />
                <input name="tp" type="number" step="0.01" placeholder="TP (points)" className="field" />
                <input name="dollarSl" type="number" step="0.01" placeholder="SL ($)" className="field" />
                <input name="dollarTp" type="number" step="0.01" placeholder="TP ($)" className="field" />
                <input name="percentageSl" type="number" step="0.01" placeholder="SL (%)" className="field" />
                <input name="percentageTp" type="number" step="0.01" placeholder="TP (%)" className="field" />
                <input name="breakeven" type="number" step="0.01" placeholder="Breakeven" className="field" />
                <input name="breakevenOffset" type="number" step="0.01" placeholder="BE offset" className="field" />
                <input name="trail" type="number" step="0.01" placeholder="Trail" className="field" />
                <input name="trailStop" type="number" step="0.01" placeholder="Trail stop" className="field" />
                <input name="trailTrigger" type="number" step="0.01" placeholder="Trail trigger" className="field" />
                <input name="trailFreq" type="number" step="0.01" placeholder="Trail freq" className="field" />
              </div>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 text-sm text-[var(--text-muted)]">
              <label className="flex items-center gap-2">
                <input name="reverseOrderClose" type="checkbox" defaultChecked />
                reverse_order_close
              </label>
              <label className="flex items-center gap-2">
                <input name="sameDirectionIgnore" type="checkbox" />
                same_direction_ignore
              </label>
              <label className="flex items-center gap-2">
                <input name="pyramid" type="checkbox" />
                pyramid
              </label>
            </div>
          </Panel>

          <Panel>
            <div className="step-rail">
              <span>Step 03</span>
              <h2 className="text-sm font-semibold">Trading accounts</h2>
            </div>
            {accounts.length === 0 ? (
              <p className="text-sm text-[var(--danger)]">
                No enabled accounts. Open Accounts and add your Tradovate account.
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-[var(--text-muted)]">Primary account</span>
                  <select
                    value={primaryId}
                    onChange={(e) => setPrimaryId(e.target.value)}
                    className="field"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.accountSpec})
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-3 mb-2 text-xs text-[var(--text-muted)]">Additional accounts</p>
                <div className="flex flex-col gap-2">
                  {accounts
                    .filter((a) => a.id !== primaryId)
                    .map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={extraIds.includes(a.id)}
                          onChange={() => toggleExtra(a.id)}
                        />
                        {a.name} · mult {a.quantityMultiplier}
                      </label>
                    ))}
                </div>
              </>
            )}
          </Panel>

          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <button type="submit" className="btn btn-primary w-fit">
            Generate alert code
          </button>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Panel
            title="Webhook URL"
            action={
              <button
                type="button"
                disabled={!webhookUrl}
                onClick={() => copy("url")}
                className="btn btn-ghost !px-2 !py-1 text-xs"
              >
                {copied === "url" ? "Copied" : "Copy"}
              </button>
            }
          >
            <pre className="overflow-x-auto rounded-lg bg-[var(--bg-muted)] p-3 font-mono text-xs text-[var(--text-muted)]">
              {webhookUrl || "Generate to reveal webhook URL"}
            </pre>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              TradingView → Alert → Notifications → Webhook URL
            </p>
          </Panel>

          <Panel
            title="Alert JSON"
            action={
              <button
                type="button"
                disabled={!json}
                onClick={() => copy("json")}
                className="btn btn-ghost !px-2 !py-1 text-xs"
              >
                {copied === "json" ? "Copied" : "Copy"}
              </button>
            }
          >
            <pre className="max-h-[22rem] overflow-auto rounded-lg bg-[var(--bg-muted)] p-3 font-mono text-xs text-[var(--text-muted)]">
              {json || "Generate to reveal alert JSON"}
            </pre>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Paste only this JSON into TradingView Alert → Message.
            </p>
            {json ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Saved alert name"
                  className="field max-w-xs"
                />
                <button type="button" onClick={saveAlert} className="btn btn-secondary">
                  Save alert
                </button>
              </div>
            ) : null}
          </Panel>

          <Panel title="Saved alerts">
            {saved.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No saved alerts yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {saved.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2 text-sm first:border-t-0 first:pt-0"
                  >
                    <button
                      type="button"
                      className="text-left hover:text-[var(--accent)]"
                      onClick={() => loadSaved(a)}
                    >
                      <span className="font-medium">{a.name}</span>
                      <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">
                        {a.source}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="text-xs text-[var(--danger)]"
                      onClick={() => deleteSaved(a.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </form>
    </div>
  );
}
