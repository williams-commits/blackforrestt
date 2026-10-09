import { randomUUID } from "node:crypto";
import { log } from "@/server/logger";

/**
 * CRM event emitter — Trade → CRM push on the internal integration surface.
 * Fire-and-forget AFTER the source transaction commits: a CRM hiccup must
 * never fail (or rollback) a trading action. Delivery is at-least-once at
 * worst; the CRM dedupes on the event id, making the end result exactly-once.
 *
 * Disabled (silent no-op) until CRM_EVENTS_URL + CRM_EVENTS_TOKEN are
 * configured — same degradation model as the CRM bridge in the other
 * direction.
 */

export type CrmEventType =
  | "payment.status_changed"
  | "payment.requires_review"
  | "kyc.status_changed"
  | "account.state_changed";

export interface CrmEvent {
  type: CrmEventType;
  platformUserId: string;
  /** Minimal, non-sensitive context (amounts/asset/state — never addresses). */
  payload: Record<string, unknown>;
  occurredAt?: Date;
}

function eventsConfig() {
  const url = process.env.CRM_EVENTS_URL?.replace(/\/$/, "");
  const token = process.env.CRM_EVENTS_TOKEN;
  return { url, token, enabled: Boolean(url && token) };
}

export function emitCrmEvent(event: CrmEvent): void {
  const { url, token, enabled } = eventsConfig();
  if (!enabled) return;
  const body = {
    id: randomUUID(),
    version: 1 as const,
    type: event.type,
    occurredAt: (event.occurredAt ?? new Date()).toISOString(),
    platformUserId: event.platformUserId,
    payload: event.payload,
  };
  void fetch(`${url}/api/internal/trade/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4000),
  })
    .then(async (response) => {
      if (!response.ok) {
        log.warn("crm_event_delivery_rejected", { type: event.type, status: response.status });
      }
    })
    .catch(() => {
      // CRM unreachable — event lost by design (notifications, not ledger);
      // the source of truth remains the trading database.
      log.warn("crm_event_delivery_failed", { type: event.type });
    });
}
