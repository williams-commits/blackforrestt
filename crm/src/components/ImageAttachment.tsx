"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * Image attachment link — shows an inline preview modal for image files
 * (PNG, JPEG, WebP, GIF) instead of downloading. Non-image files behave
 * as normal download links.
 */
const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

export function ImageAttachment({
  filename,
  mimeType,
  attachmentId,
}: {
  filename: string;
  mimeType: string;
  attachmentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const isImage = IMAGE_MIME_TYPES.includes(mimeType);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!isImage) {
    return (
      <a
        href={`/api/attachments/${attachmentId}`}
        className="font-medium hover:underline"
        style={{ color: "var(--brand-700)" }}
      >
        {filename}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 font-medium hover:underline"
        style={{ color: "var(--brand-700)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <Icon name="file" size={14} />
        {filename}
      </button>

      {open ? (
        <div
          className="modal-backdrop"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Preview: ${filename}`}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl"
            style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-modal)" }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header bar */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--border-default)" }}
            >
              <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {filename}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="Close preview"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Image */}
            <div
              className="flex items-center justify-center p-4"
              style={{ minHeight: "200px", background: "var(--bg-subtle)" }}
            >
              {!loaded ? (
                <div
                  className="skeleton"
                  style={{ width: "400px", height: "300px", borderRadius: "var(--radius-lg)" }}
                />
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/attachments/${attachmentId}`}
                alt={filename}
                onLoad={() => setLoaded(true)}
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  display: loaded ? "block" : "none",
                  borderRadius: "var(--radius-md)",
                }}
              />
            </div>

            {/* Footer with download link */}
            <div
              className="flex justify-end px-4 py-3 border-t"
              style={{ borderColor: "var(--border-default)" }}
            >
              <a
                href={`/api/attachments/${attachmentId}`}
                download={filename}
                className="btn btn-secondary"
                style={{ textDecoration: "none" }}
              >
                <Icon name="download" size={14} />
                Download
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
