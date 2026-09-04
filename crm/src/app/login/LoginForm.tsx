"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

/**
 * Staff sign-in — enterprise split layout: brand panel on the left,
 * form on the right. Clean, focused, no distraction.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn("credentials", { redirect: false, email, password });
      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }
      router.push(callbackUrl.startsWith("/") ? callbackUrl : "/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-app)" }}>
      {/* Brand panel (desktop only) */}
      <div
        className="hidden w-2/5 flex-col justify-center px-12 lg:flex"
        style={{
          background: "linear-gradient(160deg, var(--brand-800) 0%, var(--brand-900) 100%)",
          color: "var(--text-inverse)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            BF
          </span>
          <div>
            <h1 className="text-2xl font-bold">Black Forest CRM</h1>
            <p className="text-sm opacity-75">Sales & relationship management</p>
          </div>
        </div>

        <div className="mt-12 space-y-6">
          {[
            { title: "Pipeline visibility", desc: "Track every deal from first contact to close." },
            { title: "Team collaboration", desc: "Assign, share, and follow up with your team." },
            { title: "Data you can trust", desc: "Deduplication, audit trails, and scoped access." },
          ].map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <span
                className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <div>
                <p className="text-base font-semibold">{feature.title}</p>
                <p className="text-sm opacity-70">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold"
              style={{ background: "var(--brand)", color: "var(--text-inverse)" }}
            >
              BF
            </span>
            <div>
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Black Forest CRM</p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Staff sign-in</p>
            </div>
          </div>

          <h2
            className="mb-1 text-xl font-bold lg:hidden"
            style={{ color: "var(--text-primary)" }}
          >
            Sign in
          </h2>
          <p className="mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
            Enter your credentials to access the CRM.
          </p>

          <form method="post" onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div
                className="input"
                style={{
                  background: "var(--error-bg)",
                  borderColor: "var(--error-border)",
                  color: "var(--error)",
                }}
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="email" className="input-label">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="input-label">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-lg w-full"
              style={{ marginTop: "var(--space-4)" }}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
