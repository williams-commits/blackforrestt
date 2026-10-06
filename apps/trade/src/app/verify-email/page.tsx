"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

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
    <section className="w-full max-w-sm bg-canvas border border-border rounded-lg p-6">
      <h1 className="text-lg font-semibold">{t("verifyH1")}</h1>
      <p role={error ? "alert" : "status"} className={`text-sm mt-3 ${error ? "text-down" : "text-text-muted"}`}>{status}</p>
      {previewUrl && <a href={previewUrl} className="block text-xs text-brand mt-4 hover:underline">{t("devLink")}</a>}
      {!token && <form onSubmit={resend} className="mt-5">
        <label htmlFor="verification-email" className="text-xs text-text-muted">{t("email")}</label>
        <input id="verification-email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 mb-3 w-full h-10 border border-border rounded px-3 bg-canvas" />
        <Button type="submit" loading={loading} className="w-full bg-brand text-white">{t("resendVerify")}</Button>
      </form>}
      <Link href="/login" className="block text-xs text-brand text-center mt-4">{t("continueSignIn")}</Link>
    </section>
  );
}

export default function VerifyEmailPage() {
  const t = useTranslations("auth");
  return <main id="main-content" tabIndex={-1} className="min-h-screen bg-panel flex items-center justify-center p-4"><Suspense fallback={<p>{t("loading")}</p>}><VerifyEmail /></Suspense></main>;
}
