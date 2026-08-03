"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PositionSide, PositionType } from "@/lib/types";

export type OrderSubmissionStatus = "idle" | "submitting" | "accepted" | "failed";

export interface OpenPositionArgs {
  symbol: string;
  side: PositionSide;
  volume: number;
  type: PositionType;
  strikeRate?: number | null;
  expiryMinutes?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Submit a position once at a time. */
export function useOpenPosition() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderSubmissionStatus>("idle");
  const [lastAcceptedAt, setLastAcceptedAt] = useState<number | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      activeRequest.current?.abort();
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setStatus((current) => current === "failed" ? "idle" : current);
  }, []);

  const openPosition = useCallback(async (args: OpenPositionArgs): Promise<boolean> => {
    if (activeRequest.current) return false;

    const controller = new AbortController();
    activeRequest.current = controller;
    // Each user-initiated attempt gets a fresh idempotency key so the server
    // never treats a retry as a replay/conflict of a prior attempt.
    idempotencyKey.current = crypto.randomUUID();
    setLoading(true);
    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/positions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify(args),
        signal: controller.signal,
      });
      if (!response.ok) {
        const message = await readApiError(response, "Failed to open position.");
        setError(message);
        setStatus("failed");
        return false;
      }
      setStatus("accepted");
      setLastAcceptedAt(Date.now());
      return true;
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return false;
      setError("Network error opening position.");
      setStatus("failed");
      return false;
    } finally {
      activeRequest.current = null;
      idempotencyKey.current = null;
      setLoading(false);
    }
  }, []);

  return { openPosition, loading, error, clearError, status, lastAcceptedAt };
}

/** Close a position by id. */
export async function closePosition(positionId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/positions/${encodeURIComponent(positionId)}/close`, {
      method: "POST",
    });
    return response.ok;
  } catch {
    return false;
  }
}
