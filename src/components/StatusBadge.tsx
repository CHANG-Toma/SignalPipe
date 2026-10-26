type Tone = "ok" | "warn" | "danger" | "muted";

const tones: Record<Tone, string> = {
  ok: "bg-[var(--ok-soft)] text-[var(--ok)]",
  warn: "bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  muted: "bg-[var(--bg-muted)] text-[var(--text-muted)]",
};

export function StatusBadge({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] tracking-wide ${tones[tone]}`}
    >
      {label}
    </span>
  );
}
