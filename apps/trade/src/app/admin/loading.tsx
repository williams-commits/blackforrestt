import { Skeleton } from "@/components/ui/Skeleton";

/** Admin console loading skeleton — header + tab bar + content card. */
export default function AdminLoading() {
  return (
    <div className="min-h-dvh bg-canvas px-4 py-6">
      <div className="mx-auto max-w-screen-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-2xl" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
