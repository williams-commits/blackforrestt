/**
 * Imperative ephemeral toast store. Pure client state (no DB) so toasts appear
 * immediately. Use toast.success / toast.error / toast.info from any client
 * component or hook. Auto-dismissed after the duration (default 5s), capped at
 * 4 on screen. The renderer in ToastNotifications.tsx reads `useToastStore`.
 */
import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  body?: string;
  durationMs: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const MAX_TOASTS = 4;

function uid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = uid();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-MAX_TOASTS) }));
    if (toast.durationMs > 0) {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, toast.durationMs);
    }
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helpers usable from anywhere (components, hooks, modules). */
export const toast = {
  success(title: string, body?: string, durationMs = 5_000) {
    useToastStore.getState().push({ variant: "success", title, body, durationMs });
  },
  error(title: string, body?: string, durationMs = 6_000) {
    useToastStore.getState().push({ variant: "error", title, body, durationMs });
  },
  info(title: string, body?: string, durationMs = 5_000) {
    useToastStore.getState().push({ variant: "info", title, body, durationMs });
  },
  dismiss(id: string) {
    useToastStore.getState().dismiss(id);
  },
};
