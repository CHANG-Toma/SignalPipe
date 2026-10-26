type Tone = "ok" | "warn" | "danger" | "muted";

const tones: Record<Tone, string> = {
  ok: "bg-[color-mix(in_srgb,var(--ok)_18%,transparent)] text-[var(--ok)]",
  warn: "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]",
  danger: "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]",
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
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs tracking-wide ${tones[tone]}`}
    >
      {label}
    </span>
  );
}
