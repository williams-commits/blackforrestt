"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    const response = await fetch("/api/security/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    }).catch(() => null);
    setLoading(false);
    if (!response?.ok) {
      const body = response ? await response.json().catch(() => null) as { error?: string } | null : null;
      setError(body?.error ?? "Password reset failed.");
      return;
    }
    setMessage("Password reset. All existing sessions were revoked.");
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm bg-canvas border border-border rounded-lg p-6">
      <h1 className="text-lg font-semibold">Choose a new password</h1>
      <p className="text-xs text-text-muted mt-1 mb-5">Use 12–128 characters with uppercase, lowercase and a number.</p>
      <label className="text-xs text-text-muted" htmlFor="new-password">New password</label>
      <input id="new-password" type="password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 mb-3 w-full h-10 border border-border rounded px-3 bg-canvas" />
      <label className="text-xs text-text-muted" htmlFor="confirm-password">Confirm password</label>
      <input id="confirm-password" type="password" required minLength={12} maxLength={128} value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1 mb-4 w-full h-10 border border-border rounded px-3 bg-canvas" />
      {message && <p role="status" className="text-xs text-up mb-3">{message}</p>}
      {error && <p role="alert" className="text-xs text-down mb-3">{error}</p>}
      <Button type="submit" variant="brand" loading={loading} disabled={!token} className="w-full">
        Reset password
      </Button>
      <Link href="/login" className="block text-xs text-brand text-center mt-4">
        Back to sign in
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return <main id="main-content" tabIndex={-1} className="min-h-screen bg-panel flex items-center justify-center p-4"><Suspense fallback={<p>Loading…</p>}><ResetForm /></Suspense></main>;
}
