"use client";

import { Dialog } from "@/components/ui/Dialog";

interface VideoPlayerProps {
  /** YouTube video id (the `v=` parameter), not the full URL. */
  videoId: string | null;
  title: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Modal YouTube player for the education VOD pages. Embeds the video in a
 * responsive 16:9 iframe inside the existing accessible Dialog component.
 * No API key is required — uses the public youtube.com/embed endpoint.
 */
export function VideoPlayer({ videoId, title, open, onClose }: VideoPlayerProps) {
  return (
    <Dialog open={open && videoId !== null} onClose={onClose} title={title} className="max-w-3xl">
      {videoId && (
        <div className="relative w-full overflow-hidden rounded-b-lg" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}?rel=0&autoplay=1`}
            title={title}
            loading="lazy"
            allow="accelerated-sensors; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
    </Dialog>
  );
}
