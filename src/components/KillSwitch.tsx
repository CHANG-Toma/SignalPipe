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
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        className={enabled ? "btn btn-danger" : "btn btn-secondary"}
      >
        {enabled ? "Trading paused — resume" : "Pause trading"}
      </button>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
