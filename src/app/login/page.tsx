"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push("/overview");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen">
      <section className="relative hidden w-[46%] overflow-hidden bg-[var(--bg-sidebar)] lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(15,118,110,0.45), transparent 45%), radial-gradient(circle at 80% 80%, rgba(226,88,12,0.18), transparent 40%)",
          }}
        />
        <div className="relative">
          <p className="font-display text-3xl font-semibold tracking-tight text-white">
            SignalPipe
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--text-sidebar-muted)]">
            Route TradingView alerts to Tradovate with clear controls and dry-run safety.
          </p>
        </div>
        <div className="relative space-y-4 text-sm text-[var(--text-sidebar-muted)]">
          <p className="font-mono text-[11px] tracking-[0.16em] text-[var(--accent)] uppercase">
            Workflow
          </p>
          <ol className="space-y-2 text-[var(--text-inverse)]/85">
            <li>1. Connect Tradovate accounts</li>
            <li>2. Generate alert JSON</li>
            <li>3. Monitor the alerts log</li>
          </ol>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="page-enter w-full max-w-md">
          <p className="font-display text-2xl font-semibold tracking-tight lg:hidden">
            SignalPipe
          </p>
          <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Personal automation desk for Tradovate
          </p>

          <form onSubmit={onSubmit} className="panel mt-8 flex flex-col gap-4 p-6">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[var(--text-muted)]">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                className="field"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[var(--text-muted)]">Password</span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="field"
              />
            </label>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <button type="submit" disabled={busy} className="btn btn-primary mt-1">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
