"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const primary = [
  { href: "/overview", label: "Overview", hint: "Status" },
  { href: "/alerts", label: "Generate alert", hint: "TradingView" },
  { href: "/logs", label: "Alerts log", hint: "Activity" },
];

const secondary = [
  { href: "/accounts", label: "Accounts", hint: "Tradovate" },
  { href: "/settings", label: "Settings", hint: "Bridge" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] flex-col bg-[var(--bg-sidebar)] text-[var(--text-inverse)] lg:flex">
      <div className="border-b border-white/8 px-5 py-5">
        <Link href="/overview" className="block">
          <p className="font-display text-xl font-semibold tracking-tight">SignalPipe</p>
          <p className="mt-1 font-mono text-[10px] tracking-[0.18em] text-[var(--text-sidebar-muted)] uppercase">
            TV → Tradovate
          </p>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
        <NavGroup label="Workflow" items={primary} pathname={pathname} />
        <NavGroup label="Setup" items={secondary} pathname={pathname} />
      </nav>

      <div className="border-t border-white/8 p-3">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-sidebar-muted)] transition hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-inverse)]"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: Array<{ href: string; label: string; hint: string }>;
  pathname: string;
}) {
  return (
    <div>
      <p className="mb-2 px-3 font-mono text-[10px] tracking-[0.16em] text-[var(--text-sidebar-muted)] uppercase">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-[var(--bg-sidebar-hover)] text-white"
                  : "text-[var(--text-sidebar-muted)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white"
              }`}
            >
              {active ? (
                <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[var(--accent)]" />
              ) : null}
              <span className={active ? "font-medium" : ""}>{item.label}</span>
              <span className="font-mono text-[10px] opacity-50">{item.hint}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
