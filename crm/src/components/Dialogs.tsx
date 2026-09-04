"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";

/* ═══════════════════════════════════════════════════════════════════
   ConfirmDialog — replaces window.confirm with a styled, accessible modal
   ═══════════════════════════════════════════════════════════════════ */

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({
  config,
  onConfirm,
  onCancel,
}: {
  config: ConfirmConfig;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal onClose={onCancel} title={config.title} size="sm">
      <div className="modal-body">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              background: config.destructive ? "var(--error-bg)" : "var(--warning-bg)",
              color: config.destructive ? "var(--error)" : "var(--warning)",
            }}
          >
            <Icon name={config.destructive ? "alert" : "alert"} size={20} />
          </span>
          <p className="text-[14px]" style={{ color: "var(--text-secondary)", paddingTop: "8px" }}>
            {config.message}
          </p>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {config.cancelLabel ?? "Cancel"}
        </button>
        <button
          type="button"
          className={`btn ${config.destructive ? "btn-destructive" : "btn-primary"}`}
          onClick={onConfirm}
        >
          {config.confirmLabel ?? "Confirm"}
        </button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PromptDialog — replaces window.prompt with a styled, accessible modal
   ═══════════════════════════════════════════════════════════════════ */

export interface PromptConfig {
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
  maxLength?: number;
}

export function PromptDialog({
  config,
  onSubmit,
  onCancel,
}: {
  config: PromptConfig;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(config.defaultValue ?? "");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (config.required !== false && !value.trim()) return;
    onSubmit(value);
  }

  return (
    <Modal onClose={onCancel} title={config.title} size="sm">
      <form method="post" onSubmit={handleSubmit}>
        <div className="modal-body">
          <p className="mb-3 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            {config.message}
          </p>
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={config.placeholder}
            maxLength={config.maxLength ?? 200}
            required={config.required !== false}
            autoFocus
            className="input"
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {config.cancelLabel ?? "Cancel"}
          </button>
          <button type="submit" className="btn btn-primary">
            {config.confirmLabel ?? "Submit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   useConfirmDialog — hook that manages confirm dialog state
   Usage:
     const { confirm, dialog } = useConfirmDialog();
     const ok = await confirm({ title: "Delete?", message: "...", destructive: true });
     // In JSX: {dialog}
   ═══════════════════════════════════════════════════════════════════ */

export function useConfirmDialog() {
  const [config, setConfig] = useState<ConfirmConfig | null>(null);
  const [resolve, setResolve] = useState<((value: boolean) => void) | null>(null);

  function confirm(cfg: ConfirmConfig): Promise<boolean> {
    return new Promise((res) => {
      setConfig(cfg);
      setResolve(() => res);
    });
  }

  function handleConfirm() {
    resolve?.(true);
    setConfig(null);
    setResolve(null);
  }

  function handleCancel() {
    resolve?.(false);
    setConfig(null);
    setResolve(null);
  }

  const dialog = config ? (
    <ConfirmDialog config={config} onConfirm={handleConfirm} onCancel={handleCancel} />
  ) : null;

  return { confirm, dialog };
}

/* ═══════════════════════════════════════════════════════════════════
   usePromptDialog — hook that manages prompt dialog state
   Usage:
     const { prompt, dialog } = usePromptDialog();
     const value = await prompt({ title: "Task title", message: "..." });
     // In JSX: {dialog}
   ═══════════════════════════════════════════════════════════════════ */

export function usePromptDialog() {
  const [config, setConfig] = useState<PromptConfig | null>(null);
  const [resolve, setResolve] = useState<((value: string | null) => void) | null>(null);

  function prompt(cfg: PromptConfig): Promise<string | null> {
    return new Promise((res) => {
      setConfig(cfg);
      setResolve(() => res);
    });
  }

  function handleSubmit(value: string) {
    resolve?.(value);
    setConfig(null);
    setResolve(null);
  }

  function handleCancel() {
    resolve?.(null);
    setConfig(null);
    setResolve(null);
  }

  const dialog = config ? (
    <PromptDialog config={config} onSubmit={handleSubmit} onCancel={handleCancel} />
  ) : null;

  return { prompt, dialog };
}
