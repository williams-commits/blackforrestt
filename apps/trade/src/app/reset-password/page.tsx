"use client";

import { FormEvent, Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { AuthCard, AuthShell } from "@/components/auth/AuthCard";
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
    <form onSubmit={submit} className="w-full">
      <div className="mb-5">
        <label htmlFor="new-password" className="mb-1.5 block text-xs font-medium text-text-muted">{t("newPwd")}</label>
        <PasswordInput id="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="h-11" />
        <PasswordStrength password={password} className="mt-1.5" />
      </div>
      <div className="mb-5">
        <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-medium text-text-muted">{t("confirmPassword")}</label>
        <PasswordInput id="confirm-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={128} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" className="h-11" />
      </div>
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
  return (
    <AuthShell footerNote={t("riskNote")}>
      <AuthCard title={t("newPwdH1")} subtitle={t("pwdHint")}>
        <Suspense fallback={<p>{t("loading")}</p>}><ResetForm /></Suspense>
      </AuthCard>
    </AuthShell>
  );
}
