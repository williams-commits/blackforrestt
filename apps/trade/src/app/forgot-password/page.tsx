"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AuthCard, AuthShell } from "@/components/auth/AuthCard";
import { Input } from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPreviewUrl(null);
    const response = await fetch("/api/security/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setLoading(false);
    if (!response?.ok) {
      const body = response ? await response.json().catch(() => null) as { error?: string } | null : null;
      setError(body?.error ?? t("resetFail"));
      return;
    }
    const body = await response.json().catch(() => null) as { previewUrl?: string } | null;
    setPreviewUrl(body?.previewUrl ?? null);
    setMessage(
      body?.previewUrl
        ? t("resetPreview")
        : t("resetOk"),
    );
  }

  return (
    <AuthShell footerNote={t("riskNote")}>
      <AuthCard title={t("resetH1")} subtitle={t("resetSub")}>
        <form onSubmit={submit} className="w-full">
          <div className="mb-5">
            <label htmlFor="reset-email" className="mb-1.5 block text-xs font-medium text-text-muted">
              {t("email")}
            </label>
            <Input id="reset-email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" className="h-11" />
          </div>
          {message && <p role="status" className="text-xs text-up mb-3">{message}</p>}
          {previewUrl && <a href={previewUrl} className="block text-xs text-brand mb-3 hover:underline">{t("resetDevLink")}</a>}
          {error && <p role="alert" className="text-xs text-down mb-3">{error}</p>}
          <Button type="submit" variant="brand" loading={loading} className="w-full">
            {t("sendReset")}
          </Button>
          <Link href="/login" className="block text-xs text-brand text-center mt-4">
            {t("backSignIn")}
          </Link>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
