"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * Inline edit — click a value to edit it directly in the table/detail page.
 * Shows a save/cancel pair; ESC cancels. Used for status, priority, and
 * other select-type fields where a modal is overkill.
 */
export function InlineEdit({
  value,
  options,
  onSave,
  render,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onSave: (newValue: string) => Promise<void>;
  render: (value: string, onClick: () => void) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(value);

  async function save(newValue: string) {
    setSaving(true);
    try {
      await onSave(newValue);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        className="cursor-pointer rounded px-1 transition-colors hover:bg-[var(--bg-hover)]"
        title="Click to edit"
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setEditing(true);
          }
        }}
      >
        {render(value, () => setEditing(true))}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1" onBlur={() => setEditing(false)}>
      <select
        value={selected}
        onChange={(event) => {
          setSelected(event.target.value);
          void save(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setEditing(false);
          }
        }}
        disabled={saving}
        autoFocus
        className="input"
        style={{ height: "24px", fontSize: "12px", padding: "0 6px", width: "auto" }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {saving ? (
        <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>…</span>
      ) : (
        <Icon name="check" size={12} className="text-[var(--success)]" />
      )}
    </span>
  );
}
