"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clientTradeUrl } from "@/lib/branding";

interface ContactFormProps {
  /** Branding values passed from the server so the client and server render match. */
  address: string;
  email: string;
}

const SUBJECT_KEYS = ["general", "account", "deposits", "technical", "partnership"] as const;

export function ContactForm({ address, email }: ContactFormProps) {
  const t = useTranslations("contact");
  const [name, setName] = useState("");
  const [emailState, setEmail] = useState("");
  const [subject, setSubject] = useState("general");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot — must stay empty
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the translated subject label to the support inbox.
        body: JSON.stringify({ name, email: emailState, subject: t(`form.subjects.${subject}`), message, company }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError(t("form.errorRateLimit"));
        } else {
          setError(body.error || t("form.errorGeneric"));
        }
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError(t("form.errorNetwork"));
    }
    setLoading(false);
  }

  return (
    <div className="grid md:grid-cols-[1fr_300px] gap-8">
      {/* Form */}
      <div>
        {sent ? (
          <div className="bg-up/10 border border-up/30 rounded-xl p-8 text-center">
            <div className="text-3xl mb-3">✓</div>
            <h3 className="text-lg font-semibold text-up">{t("form.sentHeading")}</h3>
            <p className="mt-2 text-sm text-text-muted">
              {t("form.sentBody", { name: name || t("form.sentFallbackName"), email: emailState })}
            </p>
            <button
              onClick={() => {
                setSent(false);
                setName("");
                setEmail("");
                setMessage("");
              }}
              className="mt-4 text-sm text-brand hover:underline"
            >
              {t("form.sendAnother")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-canvas border border-border rounded-xl p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">{t("form.name")}</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5">{t("form.email")}</label>
                <input type="email" required value={emailState} onChange={(e) => setEmail(e.target.value)} className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm outline-none focus:border-brand" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">{t("form.subject")}</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full h-10 bg-canvas border border-border rounded px-2 text-sm outline-none focus:border-brand">
                {SUBJECT_KEYS.map((k) => (
                  <option key={k} value={k}>{t(`form.subjects.${k}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">{t("form.message")}</label>
              <textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-canvas border border-border rounded px-3 py-2 text-sm outline-none focus:border-brand resize-none" placeholder={t("form.messagePlaceholder")} />
            </div>
            {/* Honeypot: visually hidden and ignored by humans. Bots fill it. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
              <label>{t("form.honeypot")}</label>
              <input
                tabIndex={-1}
                autoComplete="new-password"
                name="company_name_optional"
                onChange={(e) => setCompany(e.target.value)}
                value={company}
              />
            </div>
            {error && (
              <p className="text-sm text-down bg-down/10 border border-down/30 rounded-lg px-3 py-2">{error}</p>
            )}
            <button type="submit" disabled={loading} className="h-10 px-6 rounded-lg bg-brand text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50">
              {loading ? t("form.sending") : t("form.send")}
            </button>
          </form>
        )}
      </div>

      {/* Sidebar: contact details */}
      <aside className="space-y-4">
        <div className="bg-panel border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">{t("details.heading")}</h3>
          <dl className="space-y-3 text-sm">
            {address && (
              <div>
                <dt className="text-text-faint text-xs">{t("details.address")}</dt>
                <dd className="mt-0.5">{address}</dd>
              </div>
            )}
            <div>
              <dt className="text-text-faint text-xs">{t("details.email")}</dt>
              <dd className="mt-0.5">{email}</dd>
            </div>
            <div>
              <dt className="text-text-faint text-xs">{t("details.hours")}</dt>
              <dd className="mt-0.5">{t("details.hoursValue")}</dd>
            </div>
          </dl>
        </div>
        <div className="bg-brand-soft border border-brand/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-brand">{t("clientCta.heading")}</h3>
          <p className="mt-1 text-xs text-text-muted">
            {t("clientCta.body")}
          </p>
          <a href={clientTradeUrl("/login")} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">{t("clientCta.login")}</a>
        </div>
      </aside>
    </div>
  );
}
