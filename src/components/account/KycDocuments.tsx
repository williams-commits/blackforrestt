"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import {
  ADDRESS_DOCUMENT_TYPES,
  IDENTITY_DOCUMENT_TYPES,
  KYC_DOCUMENT_TYPES,
  kycDocumentLabel,
  type KycDocumentType,
} from "@/lib/kyc";

interface DocumentView {
  id: string;
  docType: string;
  status: string;
  version: number;
  sha256: string;
  sizeBytes: number;
  detectedMime: string | null;
  declaredMime: string;
  uploadedAt: string;
  finalizedAt: string | null;
}

const MAX_BYTES = Number(process.env.NEXT_PUBLIC_KYC_MAX_BYTES ?? 10_485_760);

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: string): string {
  if (status === "CLEAN") return "Verified";
  if (status === "PENDING_SCAN") return "Awaiting verification";
  if (status === "BLOCKED") return "Rejected";
  if (status === "QUARANTINED") return "Quarantined";
  return status;
}

/** Secure KYC document upload and verification workflow. */
export function KycDocuments() {
  const selectId = useId();
  const fileId = useId();
  const [documents, setDocuments] = useState<DocumentView[]>([]);
  const [selectedType, setSelectedType] = useState<KycDocumentType>("PASSPORT");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/kyc/documents", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { documents?: DocumentView[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not load documents.");
      setDocuments(data?.documents ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load documents.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const latestByType = useMemo(() => {
    const map = new Map<string, DocumentView>();
    for (const document of documents) if (!map.has(document.docType)) map.set(document.docType, document);
    return map;
  }, [documents]);

  function validateFile(file: File): string | null {
    const allowed = new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"]);
    if (!allowed.has(file.type)) return "Only JPEG, PNG, and PDF documents are accepted.";
    if (file.size <= 0 || file.size > MAX_BYTES) return `Document must be between 1 byte and ${fmtSize(MAX_BYTES)}.`;
    return null;
  }

  async function upload(): Promise<void> {
    if (!selectedFile || loading) {
      setError("Choose a document file before uploading.");
      return;
    }
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("docType", selectedType);
      form.set("file", selectedFile);
      const uploadResponse = await fetch("/api/kyc/documents/upload", { method: "POST", body: form });
      const uploadData = (await uploadResponse.json().catch(() => null)) as { error?: string; documentId?: string } | null;
      if (!uploadResponse.ok || !uploadData?.documentId) {
        throw new Error(uploadData?.error ?? "Document upload failed.");
      }

      setBusyDocId(uploadData.documentId);
      const finalizeResponse = await fetch(`/api/kyc/documents/${uploadData.documentId}/finalize`, { method: "POST" });
      const finalizeData = (await finalizeResponse.json().catch(() => null)) as { error?: string; status?: string } | null;
      if (!finalizeResponse.ok) throw new Error(finalizeData?.error ?? "Document verification failed.");
      if (finalizeData?.status === "BLOCKED" || finalizeData?.status === "QUARANTINED") {
        throw new Error("Document was rejected by malware scanning. Upload a clean file.");
      }

      setSelectedFile(null);
      const input = document.getElementById(fileId) as HTMLInputElement | null;
      if (input) input.value = "";
      toast.success("Document verified", `${kycDocumentLabel(selectedType)} uploaded and verified.`);
      await refresh();
    } catch (cause) {
      toast.error("Upload failed", cause instanceof Error ? cause.message : "Document upload failed.");
    } finally {
      setBusyDocId(null);
      setLoading(false);
    }
  }

  async function cancel(docId: string): Promise<void> {
    setBusyDocId(docId);
    setError(null);
    try {
      const response = await fetch(`/api/kyc/documents/${docId}`, { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not cancel document.");
      toast.info("Document cancelled", "Pending document cancelled.");
      await refresh();
    } catch (cause) {
      toast.error("Cancel failed", cause instanceof Error ? cause.message : "Could not cancel document.");
    } finally {
      setBusyDocId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-canvas p-4 sm:p-6">
      <div>
        <h3 className="text-sm font-medium">Identity and proof-of-address documents</h3>
        <p className="mt-1 text-[11px] text-text-faint">
          Upload at least one identity document and one proof-of-address document. Files are scanned and sealed in private storage.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
        <div>
          <label htmlFor={selectId} className="mb-1 block text-[11px] text-text-muted">Document type</label>
          <select
            id={selectId}
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value as KycDocumentType)}
            className="h-10 w-full rounded border border-border bg-canvas px-2 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
          >
            <optgroup label="Identity">
              {IDENTITY_DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </optgroup>
            <optgroup label="Proof of address">
              {ADDRESS_DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </optgroup>
          </select>
        </div>
        <div>
          <label htmlFor={fileId} className="mb-1 block text-[11px] text-text-muted">File</label>
          <input
            id={fileId}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="block h-10 w-full rounded border border-border bg-canvas px-2 py-1.5 text-xs file:mr-3 file:rounded file:border-0 file:bg-panel-2 file:px-3 file:py-1 file:text-xs"
          />
        </div>
        <Button type="button" variant="brand" loading={loading} loadingLabel="Uploading" onClick={() => void upload()} className="h-10">
          Upload and verify
        </Button>
      </div>

      {error && <p role="alert" className="rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        {KYC_DOCUMENT_TYPES.map((type) => {
          const latest = latestByType.get(type.value);
          return (
            <article key={type.value} className="flex min-w-0 items-center justify-between gap-3 rounded border border-border-soft p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{type.label}</div>
                <div className="truncate text-[11px] text-text-faint">
                  {latest ? `${statusLabel(latest.status)} · ${fmtSize(latest.sizeBytes)}${latest.sha256 ? ` · ${latest.sha256.slice(0, 10)}…` : ""}` : "Not uploaded"}
                </div>
              </div>
              {latest?.status === "PENDING_SCAN" && (
                <Button type="button" size="sm" loading={busyDocId === latest.id} onClick={() => void cancel(latest.id)}>Cancel</Button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
