import { Skeleton } from "@/components/ui/Skeleton";

/** Reports loading skeleton — header + summary cards + table. */
export default function ReportsLoading() {
  return (
    <div className="min-h-dvh bg-canvas px-4 py-6">
      <div className="mx-auto max-w-screen-2xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
