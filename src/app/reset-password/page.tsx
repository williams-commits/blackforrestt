"use client";

import { FormEvent, Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordPolicy";

function ResetForm() {
  const t = useTranslations("auth");
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError(t("errMatch"));
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
      setError(body?.error ?? t("resetFail2"));
      return;
    }
    setMessage(t("resetDone"));
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm bg-canvas border border-border rounded-lg p-6">
      <h1 className="text-lg font-semibold">{t("newPwdH1")}</h1>
      <p className="text-xs text-text-muted mt-1 mb-5">{t("pwdHint")}</p>
      <label className="text-xs text-text-muted" htmlFor="new-password">{t("newPwd")}</label>
      <input id="new-password" type="password" required minLength={PASSWORD_MIN_LENGTH} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 mb-1 w-full h-10 border border-border rounded px-3 bg-canvas" />
      <PasswordStrength password={password} className="mb-3" />
      <label className="text-xs text-text-muted" htmlFor="confirm-password">{t("confirmPassword")}</label>
      <input id="confirm-password" type="password" required minLength={PASSWORD_MIN_LENGTH} maxLength={128} value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1 mb-4 w-full h-10 border border-border rounded px-3 bg-canvas" />
      {message && <p role="status" className="text-xs text-up mb-3">{message}</p>}
      {error && <p role="alert" className="text-xs text-down mb-3">{error}</p>}
      <Button type="submit" variant="brand" loading={loading} disabled={!token} className="w-full">
        {t("resetBtn")}
      </Button>
      <Link href="/login" className="block text-xs text-brand text-center mt-4">
        {t("backSignIn")}
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  return <main id="main-content" tabIndex={-1} className="min-h-screen bg-panel flex items-center justify-center p-4"><Suspense fallback={<p>{t("loading")}</p>}><ResetForm /></Suspense></main>;
}
