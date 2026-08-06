export default function Loading() {
  return (
    // This is a temporary loading screen that is displayed while the app is loading. It is not meant to be a permanent solution, but rather a placeholder until the app is fully loaded.
    <div className="min-h-screen bg-panel px-4 py-6">
      <div className="mx-auto max-w-screen-2xl space-y-4">
        <div className="h-12 animate-pulse rounded border border-border bg-canvas" />
        <div className="grid gap-4 lg:grid-cols-[17rem_1fr_20rem]">
          <div className="h-[calc(100dvh-7rem)] animate-pulse rounded border border-border bg-canvas" />
          <div className="h-[calc(100dvh-7rem)] animate-pulse rounded border border-border bg-canvas" />
          <div className="h-[calc(100dvh-7rem)] animate-pulse rounded border border-border bg-canvas" />
        </div>
      </div>
    </div>
  );
}

export function LoadingOverlay() {
  return (
    // This is a temporary loading overlay that is displayed while the app is loading. It is not meant to be a permanent solution, but rather a placeholder until the app is fully loaded.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-panel/80 backdrop-blur-sm">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>
  );
}

export function LoadingPage() {
  return (
    // This is a temporary loading page that is displayed while the app is loading. It is not meant to be a permanent solution, but rather a placeholder until the app is fully loaded.
    <div className="min-h-screen bg-panel px-4 py-6">
      <div className="mx-auto max-w-screen-2xl space-y-4">
        <div className="h-12 animate-pulse rounded border border-border bg-canvas" />
        <div className="grid gap-4 lg:grid-cols-[17rem_1fr_20rem]">
          <div className="h-[calc(100dvh-7rem)] animate-pulse rounded border border-border bg-canvas" />
          <div className="h-[calc(100dvh-7rem)] animate-pulse rounded border border-border bg-canvas" />
          <div className="h-[calc(100dvh-7rem)] animate-pulse rounded border border-border bg-canvas" />
        </div>
      </div>
    </div>
  );
}

export function LoadingPageOverlay() {
  return (
    // This is a temporary loading page overlay that is displayed while the app is loading. It is not meant to be a permanent solution, but rather a placeholder until the app is fully loaded.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-panel/80 backdrop-blur-sm">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>
  );
}

export function LoadingPageSkeleton() {
  return (
    // This is a temporary loading page skeleton that is displayed while the app is loading. It is not meant to be a permanent solution, but rather a placeholder until the app is fully loaded.
    <div className="min-h-screen bg-panel px-4 py-6">
      <div className="mx-auto max-w-screen-2xl space-y-4">
        <div className="h-12 animate-pulse rounded border border-border bg-canvas" />
        <div className="grid gap-4 lg:grid-cols-[17rem_1fr_20rem]">
          <div className="h-[calc(100dvh-7rem)] animate-pulse rounded border border-border bg-canvas" />
          <div className="h-[calc(100dvh-7rem)] animate-pulse rounded border border-border bg-canvas" />
          <div className="h-[calc(100dvh-7rem)] animate-pulse rounded border border-border bg-canvas" />
        </div>
      </div>
    </div>
  );
}
