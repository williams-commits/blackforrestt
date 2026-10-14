"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import {
  ADDRESS_DOCUMENT_TYPES,
  IDENTITY_DOCUMENT_TYPES,
  KYC_DOCUMENT_TYPES,
  kycDocumentLabel,
  type KycDocumentType,
} from "@/lib/kyc";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert } from "@/components/ui/Alert";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [selectedType, setSelectedType] = useState<KycDocumentType>("PASSPORT");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  // Server state via react-query; uploads/deletes invalidate.
  const { data, error: queryError } = useQuery({
    queryKey: ["account-kyc-documents"],
    queryFn: async () => {
      const response = await fetch("/api/kyc/documents", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { documents?: DocumentView[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not load documents.");
      return payload?.documents ?? [];
    },
    staleTime: 60_000,
  });
  const documents = useMemo(() => data ?? [], [data]);
  const refresh = useCallback(
    async () => { await queryClient.invalidateQueries({ queryKey: ["account-kyc-documents"] }); },
    [queryClient],
  );

  const latestByType = useMemo(() => {
    const map = new Map<string, DocumentView>();
    for (const document of documents) if (!map.has(document.docType)) map.set(document.docType, document);
    return map;
  }, [documents]);

  function validateFile(file: File): string | null {
    // Accept by extension OR browser MIME: the server verifies the actual
    // magic bytes, and file.type comes from OS registry mappings that often
    // report exotic types for .jpeg files (while .jpg reports image/jpeg).
    const allowedMime = new Set(["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "application/pdf"]);
    const allowedExtension = /\.(jpe?g|png|pdf)$/i.test(file.name);
    if (!allowedMime.has(file.type) && !allowedExtension) {
      return "Only JPEG, PNG, and PDF documents are accepted.";
    }
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
    <Card>
      <CardHeader>
        <CardTitle>Identity and proof-of-address documents</CardTitle>
        <CardDescription>
          Upload at least one identity document and one proof-of-address document. Files are scanned and sealed in private storage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
          <div>
            <Label htmlFor={selectId} className="text-xs font-medium text-muted-foreground">Document type</Label>
            <Select value={selectedType} onValueChange={(value) => setSelectedType(value as KycDocumentType)}>
              <SelectTrigger id={selectId} className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Identity</SelectLabel>
                  {IDENTITY_DOCUMENT_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Proof of address</SelectLabel>
                  {ADDRESS_DOCUMENT_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={fileId} className="text-xs font-medium text-muted-foreground">File</Label>
            <input
              id={fileId}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="block h-10 transition-colors file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:text-muted-foreground"
            />
          </div>
          <Button type="button" variant="default" loading={loading} loadingLabel="Uploading" onClick={() => void upload()}>
            Upload and verify
          </Button>
        </div>

        {(error ?? (queryError instanceof Error ? queryError.message : null)) && <Alert tone="err">{error ?? (queryError instanceof Error ? queryError.message : null)}</Alert>}

        <div className="grid gap-2 sm:grid-cols-2">
          {KYC_DOCUMENT_TYPES.map((type) => {
            const latest = latestByType.get(type.value);
            return (
              <article key={type.value} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{type.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {latest ? `${statusLabel(latest.status)} · ${fmtSize(latest.sizeBytes)}${latest.sha256 ? ` · ${latest.sha256.slice(0, 10)}…` : ""}` : "Not uploaded"}
                  </div>
                </div>
                {latest?.status === "PENDING_SCAN" && (
                  <Button type="button" size="sm" variant="outline" loading={busyDocId === latest.id} onClick={() => void cancel(latest.id)}>Cancel</Button>
                )}
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
