"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "@/components/ThemeProvider";

/** Sonner toaster on the app theme — light/dim follows the same `.dim`
 *  toggle as the rest of the UI. */
export function Toaster({ ...props }: ToasterProps) {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme === "dim" ? "dark" : "light"}
      className="toaster group"
      position="bottom-right"
      richColors
      closeButton
      {...props}
    />
  );
}
