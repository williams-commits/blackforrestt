"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/Dialogs";
import { Button } from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { CommentRow } from "@/server/records/comments";
import { Icon } from "./Icon";

/**
 * Comment thread for a work item (task, note, appointment). Posting/editing
 * is gated by the COMMENTS_CREATE permission (canComment); authors edit or
 * delete their own comments, COMMENTS_MANAGE holders anyone's (canManage).
 *
 * Lives live: refetches after local mutations and on the CRM realtime
 * refresh event (SSE bridge), so other users' comments appear without a
 * manual reload.
 */
export function CommentsSection({
  subjectType,
  subjectId,
  initial,
  canComment,
  canManage,
  currentUserId,
  compact = false,
  lazyMount = false,
}: {
  subjectType: "TASK" | "NOTE" | "APPOINTMENT";
  subjectId: string;
  initial: CommentRow[];
  canComment: boolean;
  canManage: boolean;
  currentUserId: string;
  compact?: boolean;
  /** Fetch the list on mount (inline usage where no server initial list exists). */
  lazyMount?: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [comments, setComments] = useState<CommentRow[]>(initial);
  const [loaded, setLoaded] = useState(!lazyMount);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const refresh = useCallback(async () => {
    try {
      setLoaded(true);
      const response = await fetch(`/api/comments?subjectType=${subjectType}&subjectId=${subjectId}`);
      const payload = (await response.json().catch(() => null)) as { data?: CommentRow[] } | null;
      if (response.ok) setComments(payload?.data ?? []);
    } catch {
      // Refresh is best-effort; the server-rendered initial list stands.
    }
  }, [subjectType, subjectId]);

  useEffect(() => {
    if (lazyMount) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onRealtime = () => void refresh();
    window.addEventListener("crm:realtime-refresh", onRealtime);
    return () => window.removeEventListener("crm:realtime-refresh", onRealtime);
  }, [refresh]);

  async function post(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), subjectType, subjectId }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: CommentRow; error?: string } | null;
      if (!response.ok || !payload?.data) {
        const message = payload?.error ?? "Could not post comment.";
        setError(message);
        toast.error("Comment not posted", { description: message });
        return;
      }
      setComments((current) => [...current, payload.data!]);
      setBody("");
      window.setTimeout(() => router.refresh(), 150);
    } catch {
      setError("Could not post comment.");
      toast.error("Comment not posted", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editBody.trim() || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: CommentRow; error?: string } | null;
      if (!response.ok || !payload?.data) {
        toast.error("Comment not updated", { description: payload?.error ?? "Try again." });
        return;
      }
      setComments((current) => current.map((comment) => (comment.id === id ? payload.data! : comment)));
      setEditingId(null);
      setEditBody("");
      window.setTimeout(() => router.refresh(), 150);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const confirmed = await confirm({
      title: "Delete comment",
      message: "The comment will be removed for everyone. The deletion is recorded in the audit log.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error("Comment not deleted", { description: payload?.error ?? "Try again." });
        return;
      }
      setComments((current) => current.filter((comment) => comment.id !== id));
      window.setTimeout(() => router.refresh(), 150);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {dialog}
      {canComment ? (
        <form onSubmit={post} className="space-y-2">
          <div>
            <p className="form-section-title">Discussion</p>
            <p className="form-section-help">Visible to everyone who can open this item.</p>
          </div>
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add a comment — ask a question, share context, or leave a decision for the team…"
            rows={compact ? 2 : 3}
            maxLength={5000}
            aria-label="New comment"
            className="resize-y"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && event.currentTarget.form?.requestSubmit) {
                event.currentTarget.form.requestSubmit();
              }
            }}
          />
          {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-(--text-tertiary)">{body.length.toLocaleString()} / 5,000 · ⌘/Ctrl+Enter to post</p>
            <Button type="submit" variant="primary" icon="note" loading={busy} disabled={!body.trim()}>
              Comment
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-(--text-tertiary)">Your role can view comments but not post them.</p>
      )}

      {!loaded ? (
        <Skeleton className="h-10 w-full" />
      ) : comments.length === 0 ? (
        <p className="empty-state-description">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const mayModify = comment.author.id === currentUserId || canManage;
            return (
              <li key={comment.id} className="rounded-md border border-(--border-default) bg-(--bg-surface) px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Avatar aria-hidden className="size-5.5 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {comment.author.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{comment.author.name}</span>
                  <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {relativeTime(comment.createdAt)}{comment.editedAt ? " · edited" : ""}
                  </span>
                  {mayModify ? (
                    <span className="ml-auto flex gap-2 text-[11px]">
                      <button
                        type="button"
                        className="flex items-center gap-1 text-(--text-secondary) hover:underline"
                        onClick={() => {
                          setEditingId(editingId === comment.id ? null : comment.id);
                          setEditBody(comment.body);
                        }}
                      >
                        <Icon name="edit" size={12} />
                        {editingId === comment.id ? "Cancel" : "Edit"}
                      </button>
                      <button type="button" className="flex items-center gap-1 text-(--error) hover:underline" onClick={() => void remove(comment.id)}>
                        <Icon name="trash" size={12} />
                        Delete
                      </button>
                    </span>
                  ) : null}
                </div>
                {editingId === comment.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={editBody}
                      onChange={(event) => setEditBody(event.target.value)}
                      rows={compact ? 2 : 3}
                      maxLength={5000}
                      aria-label="Edit comment"
                      className="resize-y"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button variant="primary" disabled={busy || !editBody.trim()} onClick={() => void saveEdit(comment.id)} icon="check" loading={busy}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {comment.body}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
