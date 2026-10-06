"use client";

import { useEffect, useState } from "react";
import type { InstrumentView } from "@/lib/types";

/**
 * Shared live-instruments polling hook for landing islands.
 *
 * Renders the server-provided snapshot immediately (no empty flash), then
 * polls the public /api/instruments feed on an interval and swaps in the
 * fresh list. A failed or empty payload keeps the last known snapshot —
 * prices never blank out mid-read.
 *
 * Every landing surface (both brand trees and the shared content widgets)
 * gets its live data through this one hook so refresh behavior stays uniform.
 */
export function useInstruments(
  initial: InstrumentView[],
  intervalMs = 3000,
): InstrumentView[] {
  const [instruments, setInstruments] = useState<InstrumentView[]>(initial);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/instruments", { cache: "no-store" });
        if (!response.ok || !active) return;
        const payload = (await response.json()) as { instruments?: InstrumentView[] };
        if (Array.isArray(payload.instruments) && payload.instruments.length > 0 && active) {
          setInstruments(payload.instruments);
        }
      } catch {
        /* transient — keep the last snapshot */
      }
    };
    // Fetch immediately (islands without an SSR snapshot start empty), then poll.
    void load();
    const timer = window.setInterval(() => void load(), intervalMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return instruments;
}
