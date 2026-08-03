export default function Loading() {
  return (
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
