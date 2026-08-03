"use client";

import { type KeyboardEvent, type ReactNode } from "react";

export interface Tab {
  key: string;
  label: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  right?: ReactNode;
  className?: string;
  label?: string;
}

/** Keyboard-accessible inline tab bar. */
export function Tabs({
  tabs,
  active,
  onChange,
  right,
  className = "",
  label = "Sections",
}: TabsProps) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const enabled = tabs
      .map((tab, tabIndex) => ({ tab, tabIndex }))
      .filter(({ tab }) => !tab.disabled);
    const current = enabled.findIndex(({ tabIndex }) => tabIndex === index);
    if (current < 0) return;

    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % enabled.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    else return;

    event.preventDefault();
    const target = enabled[next];
    onChange(target.tab.key);
    const container = event.currentTarget.parentElement;
    container?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target.tabIndex]?.focus();
  }

  return (
    <div className={`flex items-center border-b border-border ${className}`}>
      <div className="flex" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange(tab.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`-mb-px border-b-2 px-3 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand disabled:opacity-40 ${
                selected
                  ? "border-brand text-text"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {right ? <div className="ml-auto pr-2">{right}</div> : null}
    </div>
  );
}
