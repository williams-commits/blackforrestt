"use client";

import { Suspense, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/trade/Logo";
import { Button } from "@/components/ui/Button";
import { browserDeviceIdentity } from "@/lib/device";
import {
  AUTH_SERVICE_MESSAGE,
  safeCallbackUrl,
  signInFailureMessage,
} from "@/lib/authClient";

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = safeCallbackUrl(params.get("callbackUrl"));
  const formId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendState, setResendState] = useState<{ loading: boolean; message: string | null }>({ loading: false, message: null });

  async function resendVerification() {
    setResendState({ loading: true, message: null });
    try {
      const response = await fetch("/api/security/email-verification/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResendState({ loading: false, message: data?.error ?? "Could not resend the email. Try again later." });
      } else {
        setResendState({ loading: false, message: "If an account exists for that email, a new verification link has been sent." });
      }
    } catch {
      setResendState({ loading: false, message: "Could not reach the service. Check your connection and try again." });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowResend(false);

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        mfaCode: mfaCode.trim() || undefined,
        ...browserDeviceIdentity(),
        redirect: false,
        redirectTo: callbackUrl,
      });
      const failureMessage = signInFailureMessage(result);
      if (failureMessage) {
        setError(failureMessage);
        // On any credentials failure, check whether the entered email belongs
        // to a registered-but-unverified account. If so, offer a resend. The
        // check only ever reveals the unverified state, never account existence.
        try {
          const check = await fetch("/api/security/email-verification/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim().toLowerCase() }),
          });
          const checkData = await check.json().catch(() => ({}));
          if (checkData?.needsVerification) setShowResend(true);
        } catch {
          // Resend is a secondary affordance; never surface this check as an error.
        }
        return;
      }

      // A full navigation guarantees that the newly issued Auth.js cookie is
      // observed by middleware and server components. This avoids a stale
      // unauthenticated router cache immediately redirecting back to /login.
      window.location.assign(callbackUrl);
    } catch (cause) {
      console.error("Credential sign-in failed", cause);
      setError(AUTH_SERVICE_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const mfaId = `${formId}-mfa`;
  const errorId = `${formId}-error`;

  return (
    <form onSubmit={submit} className="w-full max-w-sm" aria-describedby={error ? errorId : undefined}>
      <div className="mb-5">
        <label htmlFor={emailId} className="block text-[11px] text-text-muted mb-1">
          Email
        </label>
        <input
          id={emailId}
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
        />
      </div>
      <div className="mb-5">
        <label htmlFor={passwordId} className="block text-[11px] text-text-muted mb-1">
          Password
        </label>
        <input
          id={passwordId}
          type="password"
          required
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
        />
      </div>
      <div className="mb-5">
        <label htmlFor={mfaId} className="block text-[11px] text-text-muted mb-1">
          Authenticator or recovery code
        </label>
        <input
          id={mfaId}
          type="text"
          maxLength={64}
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value)}
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="Required when MFA is enabled"
          className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
        />
      </div>

      {error && (
        <div
          id={errorId}
          role="alert"
          className="mb-3 rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down"
        >
          {error}
        </div>
      )}

      {showResend && (
        <div className="mb-3 rounded border border-brand/30 bg-brand-soft px-3 py-2 text-xs">
          <p className="text-text-muted mb-2">Your email is registered but not verified. Verify it to sign in.</p>
          <Button
            type="button"
            variant="brand"
            loading={resendState.loading}
            loadingLabel="Sending"
            onClick={resendVerification}
            className="w-full"
          >
            Resend verification email
          </Button>
          {resendState.message && (
            <p role="status" className="mt-2 text-[11px] text-text-muted">{resendState.message}</p>
          )}
        </div>
      )}

      <Button
        type="submit"
        variant="brand"
        loading={loading}
        loadingLabel="Signing in"
        className="w-full"
      >
        Sign in
      </Button>

      <p className="text-center text-xs text-text-muted mt-5">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-brand hover:underline">
          Register
        </Link>
      </p>
      <p className="text-center text-[11px] text-text-faint mt-3">
        <Link href="/forgot-password" className="text-brand hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-dvh items-center justify-center bg-panel px-4 py-8 sm:py-10">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-6">
          <Logo className="text-lg" />
        </div>
        <div className="w-full rounded-lg border border-border bg-canvas p-5 shadow-panel sm:p-8">
          <h1 className="text-lg font-semibold text-center mb-1">Welcome back</h1>
          <p className="text-xs text-text-muted text-center mb-6">Sign in to your trading account</p>
          <Suspense fallback={<div className="h-64" aria-label="Loading sign-in form" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-[11px] text-text-faint mt-6 text-center max-w-xs">
          Black Forest platform. Trading forex and CFDs carries a high level of risk.
        </p>
      </div>
    </main>
  );
}
