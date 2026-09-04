"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * Row action dropdown — the ⋯ kebab menu on each table row.
 * Opens a small menu with Edit, Delete, and object-specific actions.
 */
export function RowActions({
  actions,
}: {
  actions: Array<{
    label: string;
    onClick: () => void;
    icon?: string;
    destructive?: boolean;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex h-6 w-6 items-center justify-center rounded"
        style={{ color: "var(--text-tertiary)" }}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="more" size={16} />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border py-1"
          role="menu"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-default)",
            boxShadow: "var(--shadow-dropdown)",
          }}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--bg-hover)]"
              style={{
                color: action.destructive ? "var(--error)" : "var(--text-primary)",
              }}
            >
              {action.icon ? <Icon name={action.icon} size={14} /> : null}
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
