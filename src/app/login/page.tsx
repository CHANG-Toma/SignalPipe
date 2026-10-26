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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="mb-8">
        <p className="font-mono text-xs tracking-[0.25em] text-[var(--accent)] uppercase">
          SignalPipe
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Personal TradingView → Tradovate bridge
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 border border-[var(--border)] bg-[var(--bg-elevated)] p-6"
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[var(--text-muted)]">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[var(--text-muted)]">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 outline-none focus:border-[var(--accent)]"
          />
        </label>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[#07140e] hover:bg-[var(--accent-dim)] hover:text-[var(--text)] disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
