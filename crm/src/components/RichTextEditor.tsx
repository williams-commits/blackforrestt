"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "cn";
import { usePromptDialog } from "@/components/Dialogs";
import { escapeHtml, sanitizeRichText } from "@/lib/richText";

/**
 * RichTextEditor — the shared contenteditable editor behind notes, comments,
 * and other long-form message fields. Same editing surface as the email
 * composer: bold/italic/underline/strikethrough, lists, links, clear
 * formatting, ⌘/Ctrl+Enter submit, and a live plain-text character counter.
 *
 * Content is sanitized on every input with the same allowlist the server
 * applies, so the author always sees exactly what will be stored. The DOM
 * owns the content (seeded once from `defaultValue`); parents read back via
 * `onChange(text, html)` — `text` drives counters and empty checks, `html`
 * is what gets submitted.
 *
 * Because the DOM owns the content, parents that keep the editor mounted
 * after a successful submit MUST call `ref.current.clear()` — resetting
 * their own state alone leaves the typed text visible with the submit
 * button disabled (state and DOM out of sync).
 */
export interface RichTextEditorHandle {
  /** Empty the editor, sync the parent via onChange, and refocus. */
  clear: () => void;
  focus: () => void;
}

export function RichTextEditor({
  ref,
  defaultValue = "",
  placeholder = "Write something…",
  ariaLabel,
  maxLength = 5000,
  minHeight = 72,
  disabled = false,
  autoFocus = false,
  onSubmit,
  onChange,
}: {
  ref?: React.Ref<RichTextEditorHandle>;
  defaultValue?: string;
  placeholder?: string;
  ariaLabel: string;
  /** Plain-text character cap — enforced by the counter and the server. */
  maxLength?: number;
  minHeight?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  /** ⌘/Ctrl+Enter pressed inside the editor. */
  onSubmit?: () => void;
  /** Fires on every input with the plain text and the sanitized HTML. */
  onChange?: (text: string, html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [text, setText] = useState("");
  const [activeCmds, setActiveCmds] = useState<Record<string, boolean>>({});
  const { prompt: promptDialog, dialog: linkDialog } = usePromptDialog();

  // Keep the latest callback without re-subscribing the selection listener.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const emit = useCallback((editor: HTMLDivElement) => {
    const plain = (editor.innerText ?? "").replace(/\u00a0/g, " ");
    setText(plain);
    onChangeRef.current?.(plain, sanitizeRichText(editor.innerHTML));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.innerHTML = "";
        emit(editor);
        editor.focus();
      },
      focus: () => editorRef.current?.focus(),
    }),
    [emit],
  );

  const syncFromEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    emit(editor);
  }, [emit]);

  // Seed once (comment edit, draft restore) — the DOM owns the content after.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !editorRef.current) return;
    seededRef.current = true;
    if (defaultValue) {
      editorRef.current.innerHTML = defaultValue;
      emit(editorRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusRef = useRef(false);
  useEffect(() => {
    if (focusRef.current || !autoFocus || !editorRef.current) return;
    focusRef.current = true;
    editorRef.current.focus();
  }, [autoFocus]);

  // Last selection INSIDE the editor — toolbar buttons must keep working when
  // focus has moved (e.g. into the link dialog). Same fix as the email editor.
  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  const refreshToolbarState = useCallback(() => {
    try {
      setActiveCmds({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
      });
    } catch { /* queryCommandState unavailable — highlight simply stays off */ }
  }, []);

  useEffect(() => {
    const onSelectionChange = () => { saveSelection(); refreshToolbarState(); };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [saveSelection, refreshToolbarState]);

  const exec = useCallback((command: string, value?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    const inside = selection != null && selection.rangeCount > 0 && editor.contains(selection.anchorNode);
    if (!inside && savedRangeRef.current) {
      selection?.removeAllRanges();
      selection?.addRange(savedRangeRef.current);
    }
    editor.focus();
    document.execCommand(command, false, value);
    saveSelection();
    syncFromEditor();
    refreshToolbarState();
  }, [syncFromEditor, saveSelection, refreshToolbarState]);

  const toolbarButtons: Array<{ cmd: string; label: string; title: string }> = [
    { cmd: "bold", label: "B", title: "Bold (Ctrl/⌘+B)" },
    { cmd: "italic", label: "I", title: "Italic (Ctrl/⌘+I)" },
    { cmd: "underline", label: "U", title: "Underline (Ctrl/⌘+U)" },
    { cmd: "strikeThrough", label: "S", title: "Strikethrough" },
    { cmd: "insertUnorderedList", label: "• List", title: "Bullet list" },
    { cmd: "insertOrderedList", label: "1. List", title: "Numbered list" },
  ];

  async function insertLink() {
    const editor = editorRef.current;
    editor?.focus();
    const selection = window.getSelection();
    const hasSelection = Boolean(
      selection && !selection.isCollapsed && editor?.contains(selection.anchorNode),
    );
    const url = await promptDialog({
      title: "Insert link",
      message: "Choose the address the link opens (https://… or mailto:).",
      placeholder: "https://example.com",
      defaultValue: "https://",
      confirmLabel: "Insert link",
      required: true,
    });
    if (!url) return;
    if (hasSelection) exec("createLink", url);
    else exec("insertHTML", `<a href="${url.replaceAll('"', "&quot;")}">${escapeHtml(url)}</a>&nbsp;`);
  }

  const overLimit = text.length > maxLength;

  return (
    <div className="space-y-1.5">
      {linkDialog}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted p-1" role="toolbar" aria-label="Formatting">
        {toolbarButtons.map((button) => {
          const active = Boolean(activeCmds[button.cmd]);
          return (
            <button
              key={button.cmd}
              type="button"
              title={button.title}
              aria-label={button.title}
              aria-pressed={active}
              disabled={disabled}
              onMouseDown={(event) => { event.preventDefault(); }}
              onClick={() => exec(button.cmd)}
              className={cn(
                "min-w-8 rounded px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
                active
                  ? "bg-background text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              )}
            >
              {button.label}
            </button>
          );
        })}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <button
          type="button" title="Insert link" aria-label="Insert link" disabled={disabled}
          onMouseDown={(event) => { event.preventDefault(); }}
          onClick={() => void insertLink()}
          className="rounded px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-background/60 hover:text-foreground disabled:opacity-50"
        >
          Link
        </button>
        <button
          type="button" title="Clear formatting" aria-label="Clear formatting" disabled={disabled}
          onMouseDown={(event) => { event.preventDefault(); }}
          onClick={() => exec("removeFormat")}
          className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground disabled:opacity-50"
        >
          Clear
        </button>
        <span
          className={cn(
            "ml-auto text-[11px] tabular-nums",
            overLimit ? "font-semibold text-(--error)" : "text-muted-foreground",
          )}
        >
          {text.length.toLocaleString()} / {maxLength.toLocaleString()}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          aria-invalid={overLimit || undefined}
          suppressContentEditableWarning
          onInput={syncFromEditor}
          onBlur={syncFromEditor}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onSubmitRef.current?.();
            }
          }}
          data-empty={placeholder}
          style={{ minHeight }}
          className="max-h-72 overflow-y-auto bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none empty:before:content-[attr(data-empty)] empty:before:text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
        />
      </div>
    </div>
  );
}
