"use client";

import { useState } from "react";

export function KillSwitch({
  initial,
  onChange,
}: {
  initial: boolean;
  onChange?: (enabled: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const next = !enabled;
    try {
      const res = await fetch("/api/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Failed to update kill switch");
      const data = await res.json();
      setEnabled(data.killSwitch);
      onChange?.(data.killSwitch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        className={`rounded border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
          enabled
            ? "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]"
            : "border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text)] hover:border-[var(--accent)]"
        }`}
      >
        {enabled ? "Trading paused — click to resume" : "Pause trading (kill switch)"}
      </button>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
