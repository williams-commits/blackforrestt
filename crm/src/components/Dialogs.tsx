"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconInput } from "@/components/form";

/* ═══════════════════════════════════════════════════════════════════
   ConfirmDialog — replaces window.confirm with a styled, accessible
   alert dialog (shadcn AlertDialog). Destructive confirms style their
   action button destructively.
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
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia
            className={
              config.destructive
                ? "bg-destructive/10 text-destructive"
                : "bg-(--warning-bg) text-(--warning)"
            }
          >
            <Icon name="alert" size={20} />
          </AlertDialogMedia>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>{config.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {config.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={config.destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {config.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PromptDialog — replaces window.prompt with a styled, accessible
   dialog (shadcn Dialog).
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
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.message}</DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={handleSubmit} className="grid gap-4">
          <IconInput
            icon="edit"
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={config.placeholder ?? "Type your answer…"}
            maxLength={config.maxLength ?? 200}
            required={config.required !== false}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onCancel}>
              {config.cancelLabel ?? "Cancel"}
            </Button>
            <Button type="submit" variant="primary" icon="check">
              {config.confirmLabel ?? "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
