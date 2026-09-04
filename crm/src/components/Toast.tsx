"use client";

import { createContext, useCallback, useContext, useState } from "react";

/**
 * Toast notification system — slide-in messages from bottom-right.
 * Usage: `const toast = useToast(); toast.success("Saved!");`
 */

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = nextId++;
      setToasts((previous) => [...previous.slice(-4), { id, type, title, message }]);
      // Auto-dismiss after 4 seconds (errors stay 6 seconds)
      setTimeout(() => dismiss(id), type === "error" ? 6000 : 4000);
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    success: (title, message) => show("success", title, message),
    error: (title, message) => show("error", title, message),
    warning: (title, message) => show("warning", title, message),
    info: (title, message) => show("info", title, message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {toast.title}
              </p>
              {toast.message ? (
                <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  {toast.message}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 text-[14px] leading-none"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    // Safe no-op when used outside the provider (e.g. in server components)
    return {
      success: () => undefined,
      error: () => undefined,
      warning: () => undefined,
      info: () => undefined,
    };
  }
  return context;
}
