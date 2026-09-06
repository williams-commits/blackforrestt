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
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);

  function positionMenu() {
    const anchor = ref.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = 160;
    const height = actions.length * 34 + 8;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const opensUp = rect.bottom + height + 8 > window.innerHeight && rect.top > height;
    setMenuStyle({
      left,
      top: opensUp ? Math.max(8, rect.top - height - 4) : rect.bottom + 4,
      width,
    });
  }

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actions.length]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setOpen((p) => !p);
          window.requestAnimationFrame(positionMenu);
        }}
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
          className="fixed z-50 rounded-lg border py-1"
          role="menu"
          style={{
            ...menuStyle,
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
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-(--bg-hover)"
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
