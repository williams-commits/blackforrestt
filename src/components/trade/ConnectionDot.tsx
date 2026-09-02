import type { SocketStatus } from "@/lib/ws/client";

/**
 * Connection indicator — dot + label on wide screens; on phones the label
 * collapses and only the dot remains, so the metrics bar keeps its room.
 * The dot stays legible and deliberate (steady glow ring when connected,
 * soft ping while connecting) and the state is still announced to screen
 * readers via the visually-hidden label.
 */
const STATES: Record<SocketStatus, { dot: string; ring: string; label: string; text: string; pulse?: boolean }> = {
  open: { dot: "bg-up", ring: "shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-up)_18%,transparent)]", label: "Connected", text: "text-up" },
  connecting: { dot: "bg-brand", ring: "shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-brand)_18%,transparent)]", label: "Connecting", text: "text-brand", pulse: true },
  closed: { dot: "bg-down", ring: "shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-down)_18%,transparent)]", label: "Offline", text: "text-down" },
  unauthorized: { dot: "bg-down", ring: "shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-down)_18%,transparent)]", label: "Sign in required", text: "text-down" },
} as const;

export function ConnectionDot({ status }: { status: SocketStatus }) {
  const state = STATES[status];

  return (
    <div className="flex items-center gap-1.5 text-[11px]" role="status" aria-live="polite">
      <span
        className={`relative flex h-2.5 w-2.5 items-center justify-center ${state.ring} rounded-full`}
        title={state.label}
        aria-hidden="true"
      >
        {state.pulse ? (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${state.dot} opacity-50 motion-reduce:animate-none`} />
        ) : null}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${state.dot}`} />
      </span>
      {/* Label: full text on wide screens, screen-reader-only on phones. */}
      <span className={`${state.text} inline sr-only min-[420px]:sr-only min-[420px]:inline`}>{state.label}</span>
    </div>
  );
}
