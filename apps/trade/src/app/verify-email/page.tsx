"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthCard, AuthShell } from "@/components/auth/AuthCard";

function VerifyEmail() {
  const t = useTranslations("auth");
  const token = useSearchParams().get("token");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(token ? t("verifying") : t("verifyPrompt"));
  const [error, setError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetch("/api/security/email-verification/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      if (response.ok) {
        setStatus(t("verifyOk"));
        setError(false);
      } else {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        setStatus(body?.error ?? t("verifyFail"));
        setError(true);
      }
    }).catch(() => {
      setStatus(t("verifyNetFail"));
      setError(true);
    });
  }, [token, t]);

  async function resend(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/security/email-verification/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setLoading(false);
    const body = response ? await response.json().catch(() => null) as { previewUrl?: string } | null : null;
    setPreviewUrl(body?.previewUrl ?? null);
    setStatus(
      response?.ok
        ? body?.previewUrl
          ? t("verifyDevOk")
          : t("verifyEligible")
        : t("verifyUnavail"),
    );
    setError(!response?.ok);
  }

  return (
    <div className="w-full">
      <p role={error ? "alert" : "status"} className={`text-sm mt-3 ${error ? "text-down" : "text-text-muted"}`}>{status}</p>
      {previewUrl && <a href={previewUrl} className="block text-xs text-brand mt-4 hover:underline">{t("devLink")}</a>}
      {!token && <form onSubmit={resend} className="mt-5">
        <div className="mb-5">
          <label htmlFor="verification-email" className="mb-1.5 block text-xs font-medium text-text-muted">{t("email")}</label>
          <Input id="verification-email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" className="h-11" />
        </div>
        <Button type="submit" variant="brand" loading={loading} className="w-full">{t("resendVerify")}</Button>
      </form>}
      <Link href="/login" className="block text-xs text-brand text-center mt-4">{t("continueSignIn")}</Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  const t = useTranslations("auth");
  return (
    <AuthShell footerNote={t("riskNote")}>
      <AuthCard title={t("verifyH1")}>
        <Suspense fallback={<p>{t("loading")}</p>}><VerifyEmail /></Suspense>
      </AuthCard>
    </AuthShell>
  );
}
