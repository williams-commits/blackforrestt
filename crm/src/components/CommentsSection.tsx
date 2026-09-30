"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/Dialogs";
import { Button } from "@/components/ui";
import { Initials } from "@/components/Initials";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/RichTextEditor";
import { renderRichText } from "@/lib/richText";
import { relativeTime, absoluteTime } from "@/lib/time";
import { Skeleton } from "@/components/ui/skeleton";
import type { CommentRow } from "@/server/records/comments";
import { Icon } from "@/components/Icon";

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
  onCount,
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
  /** Notified whenever the thread size changes (parent badges stay in sync). */
  onCount?: (count: number) => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [comments, setComments] = useState<CommentRow[]>(initial);
  const [loaded, setLoaded] = useState(!lazyMount);
  const commentFormRef = useRef<HTMLFormElement>(null);
  const commentEditorRef = useRef<RichTextEditorHandle>(null);
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;

  useEffect(() => {
    onCountRef.current?.(comments.length);
  }, [comments.length]);

  const refresh = useCallback(async () => {
    setLoaded(false);
    try {
      const response = await fetch(`/api/comments?subjectType=${subjectType}&subjectId=${subjectId}`);
      const payload = (await response.json().catch(() => null)) as { data?: CommentRow[] } | null;
      if (response.ok) setComments(payload?.data ?? []);
    } catch {
      // Refresh is best-effort; the server-rendered initial list stands.
    } finally {
      setLoaded(true);
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
    if (!bodyText.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: bodyHtml, subjectType, subjectId }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: CommentRow; error?: string } | null;
      if (!response.ok || !payload?.data) {
        const message = payload?.error ?? "Could not post comment.";
        setError(message);
        toast.error("Comment not posted", { description: message });
        return;
      }
      setComments((current) => [...current, payload.data!]);
      commentEditorRef.current?.clear();
      window.setTimeout(() => router.refresh(), 150);
    } catch {
      setError("Could not post comment.");
      toast.error("Comment not posted", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editText.trim() || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editHtml }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: CommentRow; error?: string } | null;
      if (!response.ok || !payload?.data) {
        toast.error("Comment not updated", { description: payload?.error ?? "Try again." });
        return;
      }
      setComments((current) => current.map((comment) => (comment.id === id ? payload.data! : comment)));
      setEditingId(null);
      toast.success("Comment updated");
      setEditText("");
      setEditHtml("");
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
      toast.success("Comment deleted");
      window.setTimeout(() => router.refresh(), 150);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {dialog}
      {canComment ? (
        <form ref={commentFormRef} onSubmit={post} className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="form-section-title">Discussion {comments.length > 0 ? <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold tabular-nums text-primary">{comments.length}</span> : null}</p>
              <p className="form-section-help">Visible to everyone who can open this item.</p>
            </div>
          </div>
          <RichTextEditor
            ref={commentEditorRef}
            ariaLabel="New comment"
            placeholder="Add a comment — ask a question, share context, or leave a decision for the team…"
            maxLength={5000}
            minHeight={compact ? 56 : 72}
            disabled={busy}
            onSubmit={() => commentFormRef.current?.requestSubmit()}
            onChange={(text, html) => { setBodyText(text); setBodyHtml(html); }}
          />
          {error ? <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p> : null}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-(--text-tertiary)">⌘/Ctrl+Enter to post · formatting and links are kept</p>
            <Button type="submit" variant="primary" icon="comment" loading={busy} disabled={busy || !bodyText.trim()}>
              Comment
            </Button>
          </div>
        </form>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="comment" size={13} className="shrink-0 text-muted-foreground/60" />
          Your role can view comments but not post them.
        </p>
      )}

      {!loaded ? (
        <Skeleton className="h-10 w-full" />
      ) : comments.length === 0 ? (
        <EmptyState icon="comment" title="No comments yet" description="Start the discussion above." className="py-6" />
      ) : (
        <ul className="space-y-2">
          {comments.map((comment) => {
            const mayModify = comment.author.id === currentUserId || canManage;
            return (
              <li key={comment.id} className="group/comment rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <Initials name={comment.author.name} size="xs" />
                  <span className="text-[13px] font-semibold text-foreground">{comment.author.name}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <time dateTime={comment.createdAt} title={absoluteTime(comment.createdAt)}>{relativeTime(comment.createdAt)}</time>
                    {comment.editedAt ? <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium">edited</span> : null}
                  </span>
                  {mayModify ? (
                    <span className="ml-auto flex gap-1 text-[11px] opacity-100 transition-opacity md:opacity-0 md:focus-within:opacity-100 md:group-hover/comment:opacity-100">
                      <button
                        type="button"
                        aria-label={editingId === comment.id ? "Cancel editing comment" : "Edit comment"}
                        disabled={busy}
                        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        onClick={() => {
                          setEditingId(editingId === comment.id ? null : comment.id);
                          setEditText(comment.body);
                          setEditHtml(renderRichText(comment.body));
                        }}
                      >
                        <Icon name={editingId === comment.id ? "close" : "edit"} size={12} />
                        {editingId === comment.id ? "Cancel" : "Edit"}
                      </button>
                      <button type="button" aria-label="Delete comment" disabled={busy} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-destructive" onClick={() => void remove(comment.id)}>
                        <Icon name="trash" size={12} />
                        Delete
                      </button>
                    </span>
                  ) : null}
                </div>
                {editingId === comment.id ? (
                  <div className="mt-2 space-y-2" role="group" aria-label="Edit comment">
                    <RichTextEditor
                      defaultValue={renderRichText(comment.body)}
                      ariaLabel="Edit comment"
                      maxLength={5000}
                      minHeight={compact ? 56 : 72}
                      disabled={busy}
                      autoFocus
                      onSubmit={() => void saveEdit(comment.id)}
                      onChange={(text, html) => { setEditText(text); setEditHtml(html); }}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" disabled={busy} onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button variant="primary" disabled={busy || !editText.trim()} onClick={() => void saveEdit(comment.id)} icon="check" loading={busy}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-1.5 pl-7 text-[13px] leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
                    dangerouslySetInnerHTML={{ __html: renderRichText(comment.body) }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

