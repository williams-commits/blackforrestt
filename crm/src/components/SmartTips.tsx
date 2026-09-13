"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";

type SmartTip = {
  id: string;
  label: string;
  text: string;
  href?: string;
  action?: string;
};

const TIPS: Record<string, SmartTip[]> = {
  records: [
    { id: "records-view", label: "Keep views useful", text: "Save a filtered view for a recurring workflow such as unassigned records, recently added leads, or this week's follow-ups." },
    { id: "records-context", label: "Keep context", text: "Open a record before creating a task, note, or appointment so the next action stays connected to its history." },
    { id: "records-bulk", label: "Work in batches", text: "Select related records and use bulk actions when the same safe update applies to the whole group." },
  ],
  dashboard: [
    { id: "dashboard-task", label: "Stay ahead", text: "Start with the task that is overdue or due soon. Small, timely follow-ups keep records moving.", href: "/tasks?due=upcoming&mine=1", action: "Open my task queue" },
    { id: "dashboard-search", label: "Find faster", text: "Use global search to jump directly to a lead, contact, account, customer, or opportunity.", href: "/search", action: "Search the CRM" },
    { id: "dashboard-email", label: "Keep context", text: "Send correspondence from a record so the conversation remains attached to its activity history.", href: "/emails", action: "Open email" },
  ],
  tasks: [
    { id: "tasks-link", label: "Make work actionable", text: "Link a task to its CRM record so the next person can see the reason, history, and follow-up context.", action: "Create a linked task" },
    { id: "tasks-priority", label: "Protect focus", text: "Use urgent and high priority sparingly. Reserve them for work where timing changes the outcome." },
    { id: "tasks-filters", label: "Work in slices", text: "Combine search, priority, due date, and ownership filters to build a focused work queue." },
  ],
};

function tipIndex(context: string, count: number): number {
  const day = Math.floor(Date.now() / 86_400_000);
  let hash = day;
  for (const character of context) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % count;
}

export function SmartTips({ context = "dashboard" }: { context?: keyof typeof TIPS }) {
  const tips = TIPS[context] ?? TIPS.dashboard;
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tip, setTip] = useState<SmartTip>(tips[tipIndex(context, tips.length)]);
  const [carouselKey, setCarouselKey] = useState(0);
  const storageKey = `crm-smart-tip-dismissed:${context}`;

  useEffect(() => {
    const until = Number(window.localStorage.getItem(storageKey) ?? "0");
    if (until > Date.now()) {
      setDismissed(true);
      const timer = window.setTimeout(() => {
        window.localStorage.removeItem(storageKey);
        setTip(tips[Math.floor(Math.random() * tips.length)]!);
        setDismissed(false);
      }, until - Date.now());
      return () => window.clearTimeout(timer);
    }
    window.localStorage.removeItem(storageKey);
  }, [storageKey, tips]);

  function dismiss() {
    const delay = (30 + Math.floor(Math.random() * 91)) * 1000;
    window.localStorage.setItem(storageKey, String(Date.now() + delay));
    setDismissed(true);
  }

  function rotate() {
    setTip((current) => tips[(tips.findIndex((item) => item.id === current.id) + 1) % tips.length]);
    setCarouselKey((value) => value + 1);
  }

  useEffect(() => {
    if (dismissed || collapsed || tips.length < 2) return;
    const timer = window.setInterval(() => {
      setTip((current) => tips[(tips.findIndex((item) => item.id === current.id) + 1) % tips.length]);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [carouselKey, collapsed, dismissed, tips]);

  if (dismissed) return null;

  return (
    <aside className="animate-fade rounded-xl border p-4 text-(--text-primary)" style={{ borderColor: "var(--border-default)", background: "var(--bg-subtle)" }} aria-label="Smart tips">
      {collapsed ? (
        <button type="button" onClick={() => setCollapsed(false)} className="flex w-full items-center justify-between text-left">
          <span className="flex items-center gap-2 text-sm font-semibold text-(--text-primary)"><Icon name="lightbulb" size={15} className="text-(--text-brand)" /> Smart tips</span>
          <span className="flex items-center gap-1 text-xs font-medium text-(--text-secondary)">Show <Icon name="chevron_down" size={14} /></span>
        </button>
      ) : (
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-(--text-brand)" style={{ background: "var(--bg-surface)" }} aria-hidden><Icon name="lightbulb" size={15} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--brand-700)">{tip.label}</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={rotate} className="icon-button h-7 w-7 text-(--text-secondary) hover:text-(--text-primary)" aria-label="Show another tip" title="Show another tip"><Icon name="refresh" size={14} /></button>
              <button type="button" onClick={dismiss} className="icon-button h-7 w-7 text-(--text-secondary) hover:text-(--text-primary)" aria-label="Dismiss tips" title="Dismiss tips"><Icon name="close" size={14} /></button>
            </div>
          </div>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            {tips.map((entry) => <div key={entry.id} className="rounded-md border p-3 transition-colors" style={{ borderColor: entry.id === tip.id ? "var(--brand-500)" : "var(--border-default)", background: entry.id === tip.id ? "var(--bg-selected)" : "var(--bg-surface)" }}><p className="text-xs font-semibold text-(--text-brand)">{entry.label}</p><p className="mt-1 text-xs leading-relaxed text-(--text-secondary)">{entry.text}</p>{entry.href ? <Link href={entry.href} className="mt-2 inline-block text-xs font-semibold text-(--text-brand) hover:underline">{entry.action} -&gt;</Link> : null}</div>)}
          </div>
          <button type="button" onClick={() => setCollapsed(true)} className="icon-button mt-3 h-7 w-7 text-(--text-secondary) hover:text-(--text-primary)" aria-label="Collapse smart tips" title="Collapse smart tips"><Icon name="chevron_up" size={14} /></button>
        </div>
      </div>
      )}
    </aside>
  );
}
