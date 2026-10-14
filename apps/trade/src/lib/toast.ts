/**
 * Toast notifications on sonner. The imperative API is unchanged from the
 * previous in-house store — `toast.success/error/info(title, body?, duration)`
 * works from any client component or hook.
 */
import { toast as sonner } from "sonner";

type Variant = "success" | "error" | "info";

function emit(variant: Variant, title: string, body?: string, durationMs?: number) {
  sonner[variant](title, {
    description: body,
    duration: durationMs ?? (variant === "error" ? 6_000 : 5_000),
  });
}

export const toast = {
  success(title: string, body?: string, durationMs?: number) {
    emit("success", title, body, durationMs);
  },
  error(title: string, body?: string, durationMs?: number) {
    emit("error", title, body, durationMs);
  },
  info(title: string, body?: string, durationMs?: number) {
    emit("info", title, body, durationMs);
  },
  dismiss(id?: string) {
    sonner.dismiss(id);
  },
};
