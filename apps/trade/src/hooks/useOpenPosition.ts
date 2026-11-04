"use client";

import { useCallback, useRef, useState } from "react";
import type { AccountMetricsView, PositionSide, PositionType, PositionView } from "@/lib/types";
import { useForexStore } from "@/lib/store";

export type OrderSubmissionStatus = "idle" | "submitting" | "accepted" | "failed" | "unknown";

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

async function readApiError(
  response: Response,
  fallback: string,
): Promise<{ message: string; code?: string }> {
  try {
    const body = (await response.json()) as { error?: string; code?: string };
    return { message: body.error ?? fallback, code: body.code };
  } catch {
    return { message: fallback };
  }
}

export interface OpenPositionController {
  openPosition: (args: OpenPositionArgs) => Promise<{ ok: boolean; replayed: boolean }>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  status: OrderSubmissionStatus;
  lastAcceptedAt: number | null;
}

const PENDING_ORDER_STORAGE_KEY = "blckforest:pending-order";

function readPendingOrder(): { fingerprint: string; key: string } | null {
  try {
    const stored = window.sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    if (!stored) return null;
    const pending = JSON.parse(stored) as { fingerprint?: unknown; key?: unknown };
    return typeof pending.fingerprint === "string" && typeof pending.key === "string"
      ? { fingerprint: pending.fingerprint, key: pending.key }
      : null;
  } catch {
    return null;
  }
}

function storePendingOrder(pending: { fingerprint: string; key: string } | null): void {
  try {
    if (pending) {
      window.sessionStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify(pending));
    } else {
      window.sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
    }
  } catch {
    // The in-memory key still protects retries when browser storage is unavailable.
  }
}

/** Submit a position once at a time and safely reuse keys for ambiguous outcomes. */
export function useOpenPosition() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderSubmissionStatus>("idle");
  const [lastAcceptedAt, setLastAcceptedAt] = useState<number | null>(null);
  const activeRequest = useRef(false);
  const pendingRequest = useRef<{ fingerprint: string; key: string } | null>(null);
  const unknownOutcome = useRef(false);
  const applyPosition = useForexStore((store) => store.applyPosition);
  const applyAccount = useForexStore((store) => store.applyAccount);

  const clearError = useCallback(() => {
    if (status === "unknown") return;
    setError(null);
    setStatus((current) => current === "failed" ? "idle" : current);
  }, [status]);

  const openPosition = useCallback(async (args: OpenPositionArgs): Promise<{ ok: boolean; replayed: boolean }> => {
    if (activeRequest.current) return { ok: false, replayed: false };

    const fingerprint = JSON.stringify(args);
    if (!pendingRequest.current) {
      pendingRequest.current = readPendingOrder();
      if (pendingRequest.current) unknownOutcome.current = true;
    }
    if (unknownOutcome.current && pendingRequest.current?.fingerprint !== fingerprint) {
      setError("A previous order's status is still unknown. Retry those exact order details to confirm it before placing another order.");
      setStatus("unknown");
      return { ok: false, replayed: false };
    }

    if (pendingRequest.current?.fingerprint !== fingerprint) {
      pendingRequest.current = { fingerprint, key: crypto.randomUUID() };
      storePendingOrder(pendingRequest.current);
    }

    activeRequest.current = true;
    setLoading(true);
    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/positions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": pendingRequest.current.key,
        },
        body: JSON.stringify(args),
      });
      if (!response.ok) {
        const { message, code } = await readApiError(response, "Failed to open position.");
        const notSubmitted = code === "RATE_LIMITED" || code === "ORDER_NOT_SUBMITTED";
        const uncertain = !notSubmitted && (response.status === 408 || response.status >= 500);
        if (uncertain) {
          unknownOutcome.current = true;
          setError(`${message} The order may already have been accepted; retry the same order to confirm safely.`);
          setStatus("unknown");
        } else {
          pendingRequest.current = null;
          storePendingOrder(null);
          unknownOutcome.current = false;
          setError(message);
          setStatus("failed");
        }
        return { ok: false, replayed: false };
      }

      const result = (await response.json()) as {
        position?: PositionView;
        metrics?: AccountMetricsView;
        replayed?: boolean;
      };
      if (!result.position || typeof result.position.id !== "string") {
        unknownOutcome.current = true;
        setError("The server accepted the request but its confirmation was incomplete. Retry the same order to confirm it safely.");
        setStatus("unknown");
        return { ok: false, replayed: false };
      }

      applyPosition(result.position);
      if (result.metrics) applyAccount(result.metrics);
      pendingRequest.current = null;
      storePendingOrder(null);
      unknownOutcome.current = false;
      setStatus("accepted");
      setLastAcceptedAt(Date.now());
      return { ok: true, replayed: result.replayed === true };
    } catch {
      unknownOutcome.current = true;
      setError("We couldn't confirm the order because the request failed. It may have been accepted; retry the same order to confirm safely.");
      setStatus("unknown");
      return { ok: false, replayed: false };
    } finally {
      activeRequest.current = false;
      setLoading(false);
    }
  }, [applyAccount, applyPosition]);

  return { openPosition, loading, error, clearError, status, lastAcceptedAt };
}

/** Close a position by id. Returns the closed position's symbol and net P/L
 *  so callers can give immediate, exact feedback. */
export async function closePosition(positionId: string): Promise<{ ok: boolean; symbol?: string; netProfit?: number; error?: string }> {
  try {
    const response = await fetch(`/api/positions/${encodeURIComponent(positionId)}/close`, {
      method: "POST",
    });
    if (!response.ok) {
      const { message } = await readApiError(response, "Failed to close position.");
      return { ok: false, error: message };
    }
    const data = (await response.json().catch(() => null)) as
      | { position?: { symbol?: string; netProfit?: number } }
      | null;
    if (!data?.position) return { ok: false, error: "The position could not be closed." };
    return {
      ok: true,
      symbol: data.position.symbol,
      netProfit: typeof data.position.netProfit === "number" ? data.position.netProfit : undefined,
    };
  } catch {
    return { ok: false, error: "Network error closing position." };
  }
}

/** Update an open CFD's protective levels without touching its entry price. */
export async function updatePositionProtection(
  positionId: string,
  levels: { stopLoss: number | null; takeProfit: number | null },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/positions/${encodeURIComponent(positionId)}/protection`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(levels),
    });
    if (!response.ok) {
      const { message } = await readApiError(response, "Failed to update stop-loss and take-profit.");
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error updating position protection." };
  }
}
