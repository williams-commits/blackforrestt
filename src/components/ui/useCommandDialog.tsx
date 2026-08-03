"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export interface CommandDialogField {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea";
  initialValue?: string;
  placeholder?: string;
  help?: ReactNode;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number | string;
  inputMode?: "text" | "decimal" | "numeric";
  autoComplete?: string;
}

export type CommandDialogValues = Record<string, string>;

export interface CommandDialogRequest {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  fields?: CommandDialogField[];
  validate?: (values: CommandDialogValues) => string | null;
}

interface ActiveDialog extends CommandDialogRequest {
  fields: CommandDialogField[];
}

/**
 * Promise-based, accessible replacement for window.prompt/window.confirm.
 * Render `commandDialog` once in the caller and await `openCommand(...)` from
 * event handlers. Closing the dialog resolves the promise with null.
 */
export function useCommandDialog() {
  const [active, setActive] = useState<ActiveDialog | null>(null);
  const [values, setValues] = useState<CommandDialogValues>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const resolver = useRef<((value: CommandDialogValues | null) => void) | null>(null);

  const close = useCallback(() => {
    resolver.current?.(null);
    resolver.current = null;
    setActive(null);
    setValidationError(null);
  }, []);

  useEffect(() => () => {
    resolver.current?.(null);
    resolver.current = null;
  }, []);

  const openCommand = useCallback((request: CommandDialogRequest) => {
    resolver.current?.(null);
    const fields = request.fields ?? [];
    setValues(Object.fromEntries(fields.map((field) => [field.name, field.initialValue ?? ""])));
    setValidationError(null);
    setActive({ ...request, fields });
    return new Promise<CommandDialogValues | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!active) return;
    const normalized = Object.fromEntries(
      Object.entries(values).map(([name, value]) => [name, value.trim()]),
    );
    const error = active.validate?.(normalized) ?? null;
    if (error) {
      setValidationError(error);
      return;
    }
    resolver.current?.(normalized);
    resolver.current = null;
    setActive(null);
    setValidationError(null);
  };

  const commandDialog = (
    <Dialog
      open={Boolean(active)}
      onClose={close}
      title={active?.title ?? "Confirm action"}
      description={active?.description}
      className="sm:max-w-lg"
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {active?.fields.map((field, index) => {
            const common = {
              id: `command-${field.name}`,
              name: field.name,
              value: values[field.name] ?? "",
              required: field.required,
              minLength: field.minLength,
              maxLength: field.maxLength,
              placeholder: field.placeholder,
              autoComplete: field.autoComplete ?? "off",
              autoFocus: index === 0,
              onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                setValues((current) => ({ ...current, [field.name]: event.target.value }));
                setValidationError(null);
              },
              className: "mt-1 w-full rounded border border-border bg-canvas px-3 py-2 text-sm outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/30",
            };
            return (
              <label key={field.name} htmlFor={`command-${field.name}`} className="block text-xs font-medium text-text">
                {field.label}
                {field.type === "textarea" ? (
                  <textarea {...common} rows={4} />
                ) : (
                  <input
                    {...common}
                    type={field.type ?? "text"}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    inputMode={field.inputMode}
                  />
                )}
                {field.help ? <span className="mt-1 block text-[11px] font-normal text-text-muted">{field.help}</span> : null}
              </label>
            );
          })}
          {validationError ? (
            <p role="alert" className="rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">
              {validationError}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button type="button" variant="ghost" onClick={close}>
            {active?.cancelLabel ?? "Cancel"}
          </Button>
          <Button type="submit" variant={active?.danger ? "sell" : "default"}>
            {active?.confirmLabel ?? "Continue"}
          </Button>
        </div>
      </form>
    </Dialog>
  );

  return { openCommand, commandDialog, closeCommand: close };
}
