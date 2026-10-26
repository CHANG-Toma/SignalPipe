export function Panel({
  children,
  className = "",
  title,
  action,
  flush = false,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={`panel overflow-hidden ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}
