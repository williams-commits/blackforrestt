import { Skeleton } from "@/components/ui/Skeleton";

/** Account portal loading skeleton — sidebar navigation + content card. */
export default function AccountLoading() {
  return (
    <div className="min-h-dvh bg-canvas px-4 py-6">
      <div className="mx-auto max-w-screen-2xl space-y-4">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
          <Skeleton className="hidden h-[26rem] lg:block" />
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
