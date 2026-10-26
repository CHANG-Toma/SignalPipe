"use client";

import { useEffect, useState } from "react";

export function TopBar() {
  const [env, setEnv] = useState<"demo" | "live">("demo");
  const [mode, setMode] = useState<string>("dry-run");
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadSettings() {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = await res.json();
    setEnv(data.tradovateEnv === "live" ? "live" : "demo");
    setMode(data.tradingMode);
    setPaused(Boolean(data.killSwitch));
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function setTradovateEnv(next: "demo" | "live") {
    setBusy(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tradovateEnv: next,
        tradingMode: mode === "dry-run" ? "dry-run" : next,
      }),
    });
    setEnv(next);
    if (mode !== "dry-run") setMode(next);
    setBusy(false);
  }

  async function togglePause() {
    setBusy(true);
    const res = await fetch("/api/kill-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !paused }),
    });
    if (res.ok) {
      const data = await res.json();
      setPaused(Boolean(data.killSwitch));
    }
    setBusy(false);
  }

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_88%,white)] px-6 py-3 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="live-dot" aria-hidden />
        <div>
          <p className="text-sm font-medium">Automation desk</p>
          <p className="font-mono text-[11px] text-[var(--text-muted)]">
            mode <span className="text-[var(--text)]">{mode}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="segmented">
          <button
            type="button"
            disabled={busy}
            data-active={env === "demo"}
            onClick={() => setTradovateEnv("demo")}
          >
            Demo
          </button>
          <button
            type="button"
            disabled={busy}
            data-active={env === "live"}
            onClick={() => setTradovateEnv("live")}
            className={env === "live" ? "!text-[var(--danger)]" : undefined}
          >
            Live
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={togglePause}
          className={paused ? "btn btn-danger" : "btn btn-secondary"}
        >
          {paused ? "Resume trading" : "Pause trading"}
        </button>
      </div>
    </div>
  );
}
