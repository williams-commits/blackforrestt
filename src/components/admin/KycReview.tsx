"use client";

import { useId, useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface Submission {
  id: string;
  userId: string;
  status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  country: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  docType: string | null;
  docReference: string | null;
  note: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  user: { email: string | null; name: string | null; accountNo: string | null };
}

interface DocumentView {
  id: string;
  docType: string;
  status: string;
  sha256: string;
  sizeBytes: number;
  detectedMime: string | null;
}

interface Props {
  pending: Submission[];
  reviewed: Submission[];
  totalCount: number;
  onQueueChange?: (pending: Submission[]) => void;
  canDecide?: boolean;
  canAccessDocuments?: boolean;
}

/** Admin KYC review dashboard: queue of pending submissions + recent decisions. */
export function KycReview({
  pending: initialPending,
  reviewed,
  totalCount,
  onQueueChange,
  canDecide = false,
  canAccessDocuments = false,
}: Props) {
  const [pending, setPending] = useState(initialPending);

  // Sync local state when the parent's polled data changes (auto-sync).
  useEffect(() => { setPending(initialPending); }, [initialPending]);
  const [selected, setSelected] = useState<Submission | null>(pending[0] ?? null);
  const [rejectNote, setRejectNote] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentView[]>([]);
  const [accessReason, setAccessReason] = useState("");
  const [accessDocId, setAccessDocId] = useState<string | null>(null);
  const noteId = useId();

  function updatePending(next: Submission[]) {
    setPending(next);
    onQueueChange?.(next);
  }

  // Fetch documents for the selected submission (compliance metadata only).
  useEffect(() => {
    setDocuments([]);
    if (!selected) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/admin/kyc/${selected.id}/documents`);
      if (response.ok && !cancelled) {
        const data = (await response.json()) as { documents: DocumentView[] };
        setDocuments(data.documents);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function requestAccess(docId: string) {
    if (accessReason.trim().length < 3 || !selected) return;
    setLoading(`access:${docId}`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/kyc/documents/${docId}/access-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: accessReason.trim() }),
      });
      if (!response.ok) {
        // The error body is JSON; a successful review streams the document bytes.
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Unable to request document access.");
        return;
      }
      // The route streams the document bytes through the app origin (no CORS).
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      setAccessDocId(null);
      setAccessReason("");
    } finally {
      setLoading(null);
    }
  }

  async function review(action: "APPROVE" | "REJECT") {
    if (!selected || loading) return;
    if (action === "REJECT" && rejectNote.trim().length < 3) {
      setError("Enter a clear rejection reason.");
      return;
    }

    setLoading(action);
    setError(null);
    try {
      const response = await fetch(`/api/admin/kyc/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: action === "REJECT" ? rejectNote.trim() : "" }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "The review could not be saved.");
        return;
      }

      // Remove from queue only after the server commits the decision.
      const next = pending.filter((submission) => submission.id !== selected.id);
      updatePending(next);
      setSelected(next[0] ?? null);
      setRejectNote("");
    } catch {
      setError("Unable to reach the review service. Try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold">KYC Verification Queue</h1>
        <div className="flex gap-4 text-sm">
          <Stat label="Pending" value={pending.length} cls="text-brand" />
          <Stat label="Reviewed (shown)" value={reviewed.length} />
          <Stat label="Total submissions" value={totalCount} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
        {/* Queue list */}
        <div className="space-y-2">
          <h2 className="text-xs font-medium uppercase text-text-faint mb-1">Pending review</h2>
          {pending.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={selected?.id === s.id}
              onClick={() => { setSelected(s); setError(null); }}
              className={`w-full text-left rounded-lg border p-3 transition ${
                selected?.id === s.id ? "border-brand bg-brand-soft" : "border-border bg-canvas hover:bg-panel-2"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {s.firstName} {s.lastName}
                </span>
                <span className="text-[10px] text-text-faint">{s.submittedAt ? fmtAgo(s.submittedAt) : ""}</span>
              </div>
              <div className="text-xs text-text-muted">
                {s.user.email} · #{s.user.accountNo ?? "—"}
              </div>
              <div className="text-[11px] text-text-faint mt-0.5">{s.docType} · {s.country}</div>
            </button>
          ))}
          {pending.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-faint">
              Queue is empty — no pending submissions.
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selected ? (
            <div className="bg-canvas border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selected.firstName} {selected.lastName}
                  </h2>
                  <p className="text-sm text-text-muted">
                    {selected.user.email} · Account #{selected.user.accountNo ?? "—"}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-brand-soft text-brand font-medium">PENDING</span>
              </div>

              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Detail label="Date of Birth" value={selected.dob ? new Date(selected.dob).toLocaleDateString("en-GB") : "—"} />
                <Detail label="Country" value={selected.country ?? "—"} />
                <Detail label="Address" value={selected.address ?? "—"} />
                <Detail label="City" value={selected.city ?? "—"} />
                <Detail label="Postal Code" value={selected.postalCode ?? "—"} />
                <Detail label="Document Type" value={selected.docType ?? "—"} />
                <Detail label="Document Reference" value={selected.docReference ?? "—"} />
                <Detail label="Submitted" value={selected.submittedAt ? new Date(selected.submittedAt).toLocaleString("en-GB") : "—"} />
              </dl>

              {/* Sealed documents list — request a short-lived signed URL with a reason */}
              <div className="mt-5">
                <h3 className="mb-2 text-xs font-medium uppercase text-text-faint">Identity documents</h3>
                {documents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-faint">
                    No documents uploaded yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {documents.map((doc) => (
                      <li key={doc.id} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{doc.docType}</div>
                            <div className="text-[11px] text-text-faint">
                              {fmtSize(doc.sizeBytes)}
                              {doc.sha256 ? ` · ${doc.sha256.slice(0, 12)}…` : ""}
                              {doc.detectedMime ? ` · ${doc.detectedMime}` : ""}
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            doc.status === "CLEAN" ? "bg-up/15 text-up"
                            : doc.status === "BLOCKED" ? "bg-down/15 text-down"
                            : "bg-brand-soft text-brand"
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                        {doc.status === "CLEAN" && canAccessDocuments && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {accessDocId === doc.id ? (
                              <>
                                <input
                                  type="text"
                                  value={accessReason}
                                  onChange={(e) => setAccessReason(e.target.value)}
                                  placeholder="Reason for compliance access"
                                  className="h-9 flex-1 rounded border border-border bg-canvas px-2 text-xs"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  loading={loading === `access:${doc.id}`}
                                  disabled={accessReason.trim().length < 3}
                                  onClick={() => void requestAccess(doc.id)}
                                >
                                  Open
                                </Button>
                                <Button type="button" size="sm" onClick={() => { setAccessDocId(null); setAccessReason(""); }}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => { setAccessDocId(doc.id); setAccessReason(""); }}
                              >
                                Request access
                              </Button>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[11px] text-text-faint">
                  Access is logged with your identity and reason. Downloads open in a new tab from a short-lived signed URL.
                </p>
              </div>

              {/* Reject note */}
              {canDecide && <div className="mt-5">
                <label htmlFor={noteId} className="block text-xs text-text-muted mb-1">Rejection note (required when rejecting)</label>
                <textarea
                  id={noteId}
                  rows={2}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="e.g. Document is expired — please resubmit with a valid ID."
                  className="w-full bg-canvas border border-border rounded px-3 py-2 text-sm outline-none focus:border-brand resize-none"
                />
              </div>}

              {error && (
                <div role="alert" className="mt-4 rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">
                  {error}
                </div>
              )}

              {/* Actions */}
              {canDecide ? <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <Button
                  variant="buy"
                  size="md"
                  loading={loading === "APPROVE"}
                  loadingLabel="Approving submission"
                  disabled={loading !== null}
                  onClick={() => void review("APPROVE")}
                  className="flex-1 h-11"
                >
                  Approve and verify user
                </Button>
                <Button
                  variant="sell"
                  size="md"
                  loading={loading === "REJECT"}
                  loadingLabel="Rejecting submission"
                  disabled={loading !== null || rejectNote.trim().length < 3}
                  onClick={() => void review("REJECT")}
                  className="flex-1 h-11"
                >
                  Reject
                </Button>
              </div> : <p className="mt-5 rounded border border-border bg-panel-2 px-3 py-2 text-xs text-text-muted">Read-only compliance access.</p>}
            </div>
          ) : (
            <div className="bg-canvas border border-dashed border-border rounded-xl p-12 text-center">
              <div className="text-3xl mb-2">✓</div>
              <h3 className="text-sm font-semibold text-up">All caught up</h3>
              <p className="text-xs text-text-muted mt-1">No pending KYC submissions. Select one from the queue to review.</p>
            </div>
          )}

          {/* Recent decisions */}
          <h2 className="text-xs font-medium uppercase text-text-faint mt-8 mb-2">Recent decisions</h2>
          <div className="space-y-1.5">
            {reviewed.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-canvas px-3 py-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium">{s.firstName} {s.lastName}</span>
                  <span className="text-xs text-text-muted ml-2">{s.user.email}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${s.status === "APPROVED" ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>
                    {s.status}
                  </span>
                  <span className="text-[11px] text-text-faint">{s.reviewedAt ? fmtAgo(s.reviewedAt) : ""}</span>
                </div>
              </div>
            ))}
            {reviewed.length === 0 && (
              <div className="text-xs text-text-faint py-3 text-center">No decisions yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: number; cls?: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={`text-lg font-bold tnum ${cls}`}>{value}</span>
      <span className="text-text-faint text-xs">{label}</span>
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-text-faint uppercase">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function fmtAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
