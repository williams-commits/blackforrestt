"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePromptDialog } from "@/components/Dialogs";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { IconSelectTrigger } from "@/components/form";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

const RECORD_PATH: Record<string, string> = {
  LEAD: "leads",
  CONTACT: "contacts",
  ACCOUNT: "accounts",
  CUSTOMER: "customers",
  OPPORTUNITY: "opportunities",
};

const MAX_BODY = 20_000;

export interface EmailComposeProps {
  subjectType?: SubjectType;
  subjectId?: string;
  toEmail?: string | null;
  toName?: string;
  initialSubject?: string;
  initialBody?: string;
  initialHtml?: string;
  onClose: () => void;
  onSent?: () => void;
}

interface Draft {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  html?: string;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Client-side copy of the server allowlist, so previews match what sends. */
function sanitizeClient(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  root.querySelectorAll("script,style,iframe,object,embed,noscript,template,svg,math").forEach((el) => el.remove());
  const walk = (node: Element): void => {
    Array.from(node.children).forEach((child) => {
      walk(child);
      const tag = child.tagName.toUpperCase();
      const allowed = ["P", "BR", "DIV", "SPAN", "BLOCKQUOTE", "PRE", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "UL", "OL", "LI", "H1", "H2", "H3", "A", "FONT"];
      if (!allowed.includes(tag)) {
        const frag = document.createDocumentFragment();
        while (child.firstChild) frag.appendChild(child.firstChild);
        child.replaceWith(frag);
        return;
      }
      if (tag === "A") {
        const href = child.getAttribute("href") ?? "";
        if (!/^(https?:\/\/|mailto:)/i.test(href)) child.removeAttribute("href");
        else {
          child.setAttribute("rel", "noopener noreferrer");
          child.setAttribute("target", "_blank");
        }
      }
      Array.from(child.attributes).forEach((attr) => {
        if (tag === "A" && attr.name === "href") return;
        child.removeAttribute(attr.name);
      });
    });
  };
  walk(root);
  return root.innerHTML;
}

export function EmailCompose({
  subjectType,
  subjectId,
  toEmail,
  toName,
  initialSubject,
  initialBody,
  initialHtml,
  onClose,
  onSent,
}: EmailComposeProps) {
  const linked = Boolean(subjectType && subjectId);
  const draftKey = `crm-email-draft:${subjectType ?? "free"}:${subjectId ?? toEmail ?? "new"}`;

  const [to, setTo] = useState(toEmail ?? "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [ccVisible, setCcVisible] = useState(false);
  const [bccVisible, setBccVisible] = useState(false);
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [bodyText, setBodyText] = useState(initialBody ?? "");
  const [bodyHtml, setBodyHtml] = useState(initialHtml ?? "");
  const [createFollowUp, setCreateFollowUp] = useState(linked);
  const [followUpInDays, setFollowUpInDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const { prompt: promptDialog, dialog: linkDialog } = usePromptDialog();

  // ── Draft restore ──
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved && !initialBody && !initialHtml) {
        const draft = JSON.parse(saved) as Draft;
        if (draft.to && !toEmail) setTo(draft.to);
        if (draft.cc) { setCc(draft.cc); setCcVisible(true); }
        if (draft.bcc) { setBcc(draft.bcc); setBccVisible(true); }
        if (draft.subject && !initialSubject) setSubject(draft.subject);
        if (draft.body) setBodyText(draft.body);
        if (draft.html && editorRef.current) editorRef.current.innerHTML = draft.html;
      }
    } catch { /* draft restore is best-effort */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // ── Seed the editor with the initial content (after restore, restore wins) ──
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !editorRef.current) return;
    seededRef.current = true;
    if (initialHtml && editorRef.current) {
      editorRef.current.innerHTML = initialHtml;
      setBodyText(editorRef.current.innerText ?? "");
      setBodyHtml(initialHtml);
    } else if (initialBody) {
      editorRef.current.innerHTML = initialBody
        .split("\n")
        .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
        .join("");
      setBodyText(initialBody);
      setBodyHtml(editorRef.current.innerHTML);
    }
  }, [initialBody, initialHtml]);

  // ── Draft autosave (debounced) ──
  const saveDraft = useCallback((next: Draft) => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(next));
    } catch { /* storage full/blocked — drafts are best-effort */ }
  }, [draftKey]);

  useEffect(() => {
    // A pristine composer must never autosave — its empty state would wipe a
    // stored draft before the restore effect gets a chance to run.
    if (!to && !cc && !bcc && !subject && !bodyText) return;
    const timer = window.setTimeout(
      () => saveDraft({ to, cc, bcc, subject, body: bodyText, html: bodyHtml }),
      500,
    );
    return () => window.clearTimeout(timer);
  }, [to, cc, bcc, subject, bodyText, bodyHtml, saveDraft]);

  // ── SMTP configured? ──
  useEffect(() => {
    void fetch("/api/emails/send")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setSmtpConfigured(Boolean(body?.data?.configured)))
      .catch(() => setSmtpConfigured(false));
  }, []);

  // ── Rich-text editor plumbing ──
  const syncFromEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = (editor.innerText ?? "").replace(/\u00a0/g, " ");
    setBodyText(text.slice(0, MAX_BODY));
    setBodyHtml(sanitizeClient(editor.innerHTML));
  }, []);

  // Last selection INSIDE the editor. Toolbar buttons must apply formatting
  // to the user's text even when focus has moved elsewhere (subject field,
  // a dialog) — without this, execCommand silently targeted a detached or
  // reset caret and the buttons appeared to do nothing.
  const savedRangeRef = useRef<Range | null>(null);
  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  // Active formatting state — drives the toolbar's pressed highlight.
  const [activeCmds, setActiveCmds] = useState<Record<string, boolean>>({});
  const refreshToolbarState = useCallback(() => {
    try {
      setActiveCmds({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
      });
    } catch { /* queryCommandState unavailable — highlight simply stays off */ }
  }, []);

  useEffect(() => {
    const onSelectionChange = () => { saveSelection(); refreshToolbarState(); };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [saveSelection, refreshToolbarState]);

  const exec = useCallback((command: string, value?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    // Restore the saved editor selection BEFORE focusing — focus() itself
    // resets the caret when the selection sits elsewhere, which would
    // defeat the restore and silently retarget the command.
    const selection = window.getSelection();
    const inside = selection != null && selection.rangeCount > 0 && editor.contains(selection.anchorNode);
    if (!inside && savedRangeRef.current) {
      selection?.removeAllRanges();
      selection?.addRange(savedRangeRef.current);
    }
    editor.focus();
    document.execCommand(command, false, value);
    saveSelection();
    syncFromEditor();
    refreshToolbarState();
  }, [syncFromEditor, saveSelection, refreshToolbarState]);

  const send = useCallback(async () => {
    setError(null);
    const editor = editorRef.current;
    const plainText = (editor?.innerText ?? bodyText).trim();
    if (!to.trim() || !subject.trim() || !plainText) {
      setError("To, subject, and message are required.");
      return;
    }
    if (plainText.length > MAX_BODY) {
      setError(`Message is too long — keep it under ${MAX_BODY.toLocaleString()} characters.`);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim(),
          body: plainText,
          html: editor?.innerHTML,
          ...(linked ? { subjectType, subjectId } : {}),
          createFollowUp: linked ? createFollowUp : undefined,
          followUpInDays: linked ? followUpInDays : undefined,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Send failed.");
        return;
      }
      try { window.localStorage.removeItem(draftKey); } catch { /* best-effort */ }
      setSent(true);
      onSent?.();
    } finally {
      setBusy(false);
    }
  }, [to, cc, bcc, subject, bodyText, linked, subjectType, subjectId, createFollowUp, followUpInDays, draftKey, onSent]);

  // ⌘/Ctrl+Enter sends from any field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (!busy && !sent) void send();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, busy, sent]);

  const canSend = !busy && !sent && Boolean(to.trim()) && Boolean(subject.trim()) && Boolean(bodyText.trim());

  const toolbarButtons: Array<{ cmd: string; label: string; title: string; value?: string }> = [
    { cmd: "bold", label: "B", title: "Bold (Ctrl/⌘+B)" },
    { cmd: "italic", label: "I", title: "Italic (Ctrl/⌘+I)" },
    { cmd: "underline", label: "U", title: "Underline (Ctrl/⌘+U)" },
    { cmd: "strikeThrough", label: "S", title: "Strikethrough" },
    { cmd: "insertUnorderedList", label: "• List", title: "Bullet list" },
    { cmd: "insertOrderedList", label: "1. List", title: "Numbered list" },
  ];

  async function insertLink() {
    editorRef.current?.focus();
    const selection = window.getSelection();
    const hasSelection = Boolean(
      selection && !selection.isCollapsed && editorRef.current?.contains(selection.anchorNode),
    );
    const url = await promptDialog({
      title: "Insert link",
      message: "Choose the address the link opens (https://… or mailto:).",
      placeholder: "https://example.com",
      defaultValue: "https://",
      confirmLabel: "Insert link",
      required: true,
    });
    if (!url) return;
    // With selected text createLink wraps it; with no selection insert the
    // URL itself as the link text at the cursor.
    if (hasSelection) exec("createLink", url);
    else exec("insertHTML", `<a href="${url.replaceAll('"', "&quot;")}">${escapeHtml(url)}</a>&nbsp;`);
  }

  return (
    <>
      <Modal title={sent ? "Email sent" : "New email"} onClose={onClose} size="xl" closeOnBackdrop={false}>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={linked ? "border-(--info-border) bg-(--info-bg) text-(--info)" : undefined}>
            {linked ? "Linked to record" : "Shared mailbox"}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {linked
              ? "Appears in the record's email history."
              : "Visible to every EMAILS_VIEW holder."}
          </p>
        </div>

        {/* SMTP warning */}
        {smtpConfigured === false ? (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2.5 text-sm text-foreground">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>SMTP is not configured.</strong> Sending is disabled — set{" "}
              <code className="rounded bg-background px-1 font-mono text-xs">SMTP_URL</code> (or ask an admin to add your personal SMTP) and reload.
            </span>
          </div>
        ) : null}

        {sent ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted p-3 text-sm text-foreground">
              <span aria-hidden>✓</span> Email sent{createFollowUp && linked ? ` — follow-up task created for ${followUpInDays} day(s)` : ""}.
            </div>
            <div className="flex gap-2">
              {linked && subjectType ? (
                <Button variant="secondary" href={`/${RECORD_PATH[subjectType]}/${subjectId}`}>View record</Button>
              ) : null}
              <Button variant="primary" href="/emails">Open mailbox →</Button>
              <Button variant="secondary" onClick={onClose} className="ml-auto">Close</Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => { event.preventDefault(); void send(); }}
            className="space-y-4"
          >
            {error ? (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            ) : null}

            {/* Recipients */}
            <div className="divide-y divide-border rounded-lg bg-muted">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <label htmlFor="ec-to" className="w-14 shrink-0 text-sm font-medium text-muted-foreground">To</label>
                <Icon name="mail" size={13} className="shrink-0 text-muted-foreground" />
                <input
                  id="ec-to" type="email" value={to} required disabled={busy}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="recipient@example.com"
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none" autoFocus
                />
                <div className="flex shrink-0 gap-2">
                  {!ccVisible ? (
                    <button type="button" onClick={() => setCcVisible(true)} className="text-xs font-medium text-foreground hover:underline">Cc</button>
                  ) : null}
                  {!bccVisible ? (
                    <button type="button" onClick={() => setBccVisible(true)} className="text-xs font-medium text-foreground hover:underline">Bcc</button>
                  ) : null}
                </div>
              </div>
              {ccVisible ? (
                <div className="flex items-center gap-3 px-4 py-2">
                  <label htmlFor="ec-cc" className="w-14 shrink-0 text-sm font-medium text-muted-foreground">Cc</label>
                  <Icon name="users" size={13} className="shrink-0 text-muted-foreground" />
                  <input
                    id="ec-cc" type="email" value={cc} disabled={busy}
                    onChange={(event) => setCc(event.target.value)}
                    placeholder="copy@example.com"
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                  />
                  <button
                    type="button" aria-label="Close Cc field" disabled={busy}
                    onClick={() => { setCc(""); setCcVisible(false); }}
                    className="text-sm text-muted-foreground hover:text-destructive"
                  >×</button>
                </div>
              ) : null}
              {bccVisible ? (
                <div className="flex items-center gap-3 px-4 py-2">
                  <label htmlFor="ec-bcc" className="w-14 shrink-0 text-sm font-medium text-muted-foreground">Bcc</label>
                  <Icon name="users" size={13} className="shrink-0 text-muted-foreground" />
                  <input
                    id="ec-bcc" type="email" value={bcc} disabled={busy}
                    onChange={(event) => setBcc(event.target.value)}
                    placeholder="blind-copy@example.com"
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                  />
                  <button
                    type="button" aria-label="Close Bcc field" disabled={busy}
                    onClick={() => { setBcc(""); setBccVisible(false); }}
                    className="text-sm text-muted-foreground hover:text-destructive"
                  >×</button>
                </div>
              ) : null}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <label htmlFor="ec-subject" className="w-14 shrink-0 text-sm font-medium text-muted-foreground">Subject</label>
                <Icon name="tag" size={13} className="shrink-0 text-muted-foreground" />
                <input
                  id="ec-subject" value={subject} required maxLength={300} disabled={busy}
                  onChange={(event) => setSubject(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none"
                />
              </div>
            </div>

            {/* Formatting toolbar */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted p-1" role="toolbar" aria-label="Formatting">
              {toolbarButtons.map((button) => {
                const active = Boolean(activeCmds[button.cmd]);
                return (
                  <button
                    key={button.cmd}
                    type="button"
                    title={button.title}
                    aria-label={button.title}
                    aria-pressed={active}
                    disabled={busy}
                    onMouseDown={(event) => { event.preventDefault(); }}
                    onClick={() => exec(button.cmd, button.value)}
                    className={cn(
                      "min-w-8 rounded px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                      active
                        ? "bg-background text-foreground ring-1 ring-border"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    )}
                  >
                    {button.label}
                  </button>
                );
              })}
              <span className="mx-1 h-4 w-px bg-border" aria-hidden />
              <button
                type="button" title="Insert link" aria-label="Insert link" disabled={busy}
                onMouseDown={(event) => { event.preventDefault(); }}
                onClick={() => insertLink()}
                className="rounded px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-background/60 hover:text-foreground disabled:opacity-50"
              >
                Link
              </button>
              <button
                type="button" title="Clear formatting" aria-label="Clear formatting" disabled={busy}
                onMouseDown={(event) => { event.preventDefault(); }}
                onClick={() => exec("removeFormat")}
                className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground disabled:opacity-50"
              >
                Clear
              </button>
            </div>

            {/* Rich-text body */}
            <div className="overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
              <div
                ref={editorRef}
                contentEditable={!busy && !sent}
                role="textbox"
                aria-multiline="true"
                aria-label="Email body"
                suppressContentEditableWarning
                onInput={syncFromEditor}
                onBlur={syncFromEditor}
                data-empty={bodyText ? undefined : (toName ? `Hi ${toName.split(" ")[0]},` : "Write your message…")}
                className="min-h-80 max-h-[26rem] overflow-y-auto bg-background px-4 py-3 text-sm leading-relaxed text-foreground outline-none empty:before:content-[attr(data-empty)] empty:before:text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
              />
            </div>
            <p className="text-right text-[11px] text-muted-foreground">
              {bodyText.length.toLocaleString()} / {MAX_BODY.toLocaleString()} characters · ⌘/Ctrl+Enter to send
            </p>

            {linked ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted px-3 py-2.5">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={createFollowUp} disabled={busy}
                    onCheckedChange={(checked) => setCreateFollowUp(checked === true)}
                  />
                  Create follow-up task in
                </label>
                <Select
                  value={String(followUpInDays)}
                  onValueChange={(value) => setFollowUpInDays(parseInt(value, 10))}
                  disabled={!createFollowUp || busy}
                >
                  <IconSelectTrigger size="sm" icon="list" className="h-7 w-fit text-xs" aria-label="Follow-up days">
                    <SelectValue />
                  </IconSelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 7, 14, 30].map((days) => (
                      <SelectItem key={days} value={String(days)}>{days} day{days > 1 ? "s" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {linked ? "Archived to this record's email history." : "Archived to the shared mailbox."}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
                <Button variant="primary" icon="mail" type="submit" loading={busy} disabled={!canSend || smtpConfigured === false}>
                  Send
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
      {linkDialog}
    </>
  );
}
