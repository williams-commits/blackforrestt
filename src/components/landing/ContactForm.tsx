"use client";

import { useState } from "react";
import { clientTradeUrl } from "@/lib/branding";

interface ContactFormProps {
  /** Branding values passed from the server so the client and server render match. */
  address: string;
  email: string;
}

export function ContactForm({ address, email }: ContactFormProps) {
  const [name, setName] = useState("");
  const [emailState, setEmail] = useState("");
  const [subject, setSubject] = useState("General enquiry");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // No backend endpoint yet — simulate a successful submission.
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="grid md:grid-cols-[1fr_300px] gap-8">
      {/* Form */}
      <div>
        {sent ? (
          <div className="bg-up/10 border border-up/30 rounded-xl p-8 text-center">
            <div className="text-3xl mb-3">✓</div>
            <h3 className="text-lg font-semibold text-up">Message sent</h3>
            <p className="mt-2 text-sm text-text-muted">
              Thanks, {name || "there"}! We&apos;ve received your message and will reply to{" "}
              <span className="font-medium text-text">{emailState}</span> within one business day.
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
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-canvas border border-border rounded-xl p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Full Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Email</label>
                <input type="email" required value={emailState} onChange={(e) => setEmail(e.target.value)} className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm outline-none focus:border-brand" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full h-10 bg-canvas border border-border rounded px-2 text-sm outline-none focus:border-brand">
                <option>General enquiry</option>
                <option>Account & verification</option>
                <option>Deposits & withdrawals</option>
                <option>Technical issue</option>
                <option>Partnership</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Message</label>
              <textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-canvas border border-border rounded px-3 py-2 text-sm outline-none focus:border-brand resize-none" placeholder="How can we help?" />
            </div>
            <button type="submit" disabled={loading} className="h-10 px-6 rounded-lg bg-brand text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50">
              {loading ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </div>

      {/* Sidebar: contact details */}
      <aside className="space-y-4">
        <div className="bg-panel border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">Contact details</h3>
          <dl className="space-y-3 text-sm">
            {address && (
              <div>
                <dt className="text-text-faint text-xs">Address</dt>
                <dd className="mt-0.5">{address}</dd>
              </div>
            )}
            <div>
              <dt className="text-text-faint text-xs">Email</dt>
              <dd className="mt-0.5">{email}</dd>
            </div>
            <div>
              <dt className="text-text-faint text-xs">Support hours</dt>
              <dd className="mt-0.5">24 hours, 7 days a week</dd>
            </div>
          </dl>
        </div>
        <div className="bg-brand-soft border border-brand/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-brand">Already a client?</h3>
          <p className="mt-1 text-xs text-text-muted">The fastest way to get help is our in-platform live chat.</p>
          <a href={clientTradeUrl("/login")} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Log in →</a>
        </div>
      </aside>
    </div>
  );
}
