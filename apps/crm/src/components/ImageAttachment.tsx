"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";

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
        className="font-medium text-foreground hover:underline"
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
        className="inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 font-medium text-foreground hover:underline"
      >
        <Icon name="file" size={14} />
        {filename}
      </button>

      {open ? (
        <Modal onClose={() => setOpen(false)} title={filename} size="xl">
          {/* Image */}
          <div className="flex items-center justify-center rounded-lg bg-muted p-4" style={{ minHeight: "200px" }}>
            {!loaded ? (
              <Skeleton className="h-75 w-100" />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/attachments/${attachmentId}`}
              alt={filename}
              onLoad={() => setLoaded(true)}
              className="max-h-[70vh] max-w-full rounded-md object-contain"
              style={{ display: loaded ? "block" : "none" }}
            />
          </div>

          {/* Footer with download link */}
          <div className="flex justify-end pt-3">
            {/* Plain anchor styled through the shadcn button system — the
                Button seam's href mode cannot carry the download attribute. */}
            <a
              href={`/api/attachments/${attachmentId}`}
              download={filename}
              className={buttonVariants({ variant: "outline" })}
            >
              <Icon name="download" size={14} />
              Download
            </a>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
