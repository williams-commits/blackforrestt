"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Password input with a show/hide (eye) toggle. Drops in anywhere a plain
 * `<input type="password">` was used — all input props pass through, with
 * right padding reserved for the eye button.
 */
export function PasswordInput({ className = "", ...inputProps }: React.InputHTMLAttributes<HTMLInputElement>) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative w-full">
      <input
        {...inputProps}
        type={visible ? "text" : "password"}
        className={`${className} ${className.includes("pr-") ? "" : "pr-10"}`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? t("hidePwd") : t("showPwd")}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-faint transition-colors hover:text-text"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return <Eye size={14} strokeWidth={1.75} aria-hidden />;
}

function EyeOffIcon() {
  return <EyeOff size={14} strokeWidth={1.75} aria-hidden />;
}
