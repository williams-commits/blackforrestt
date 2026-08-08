"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

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
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-panel flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-canvas border border-border rounded-lg p-6">
        <h1 className="text-lg font-semibold">{t("resetH1")}</h1>
        <p className="text-xs text-text-muted mt-1 mb-5">{t("resetSub")}</p>
        <label className="text-xs text-text-muted" htmlFor="reset-email">{t("email")}</label>
        <input id="reset-email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 mb-4 w-full h-10 border border-border rounded px-3 bg-canvas" />
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
    </main>
  );
}
