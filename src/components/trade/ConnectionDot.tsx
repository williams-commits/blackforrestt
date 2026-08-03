import type { SocketStatus } from "@/lib/ws/client";

/** Small, announced connection indicator. */
export function ConnectionDot({ status }: { status: SocketStatus }) {
  const map = {
    open: { color: "bg-up", label: "Connected", text: "text-up" },
    connecting: { color: "bg-brand", label: "Connecting", text: "text-brand" },
    closed: { color: "bg-down", label: "Offline", text: "text-down" },
    unauthorized: { color: "bg-down", label: "Sign in required", text: "text-down" },
  } as const;
  const state = map[status];

  return (
    <div className="flex items-center gap-1.5 text-[11px]" role="status" aria-live="polite">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {status === "connecting" ? (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${state.color} opacity-60`}
          />
        ) : null}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${state.color}`} />
      </span>
      <span className={state.text}>{state.label}</span>
    </div>
  );
}
