import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/server/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 1800; // events change slowly; cache 30 minutes

type Impact = "low" | "medium" | "high";

interface CalendarItem {
  id: string;
  iso: string;
  currency: string;
  impact: Impact;
  title: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

/** Returns "finnhub" or "forexfactory" (default). */
function calendarSource(): "finnhub" | "forexfactory" {
  const value = (process.env.ECONOMIC_CALENDAR_SOURCE ?? "forexfactory").trim().toLowerCase();
  return value === "finnhub" ? "finnhub" : "forexfactory";
}

// ── Forex Factory (free, no key, rate-limited) ──────────────────────────────

interface FfEvent {
  title: string;
  country: string;
  date: string;
  impact: "Low" | "Medium" | "High";
  forecast: string;
  previous: string;
  actual?: string;
}

async function fetchForexFactory(): Promise<CalendarItem[]> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.forexfactory.com/",
  };
  const [thisWeek, nextWeek] = await Promise.allSettled([
    fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", { headers, signal: AbortSignal.timeout(10_000), cache: "no-store" }),
    fetch("https://nfs.faireconomy.media/ff_calendar_nextweek.json", { headers, signal: AbortSignal.timeout(10_000), cache: "no-store" }),
  ]);
  const raw: FfEvent[] = [];
  for (const result of [thisWeek, nextWeek]) {
    if (result.status !== "fulfilled") continue;
    const res = result.value;
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) continue;
    const data = await res.json().catch(() => []);
    if (Array.isArray(data)) raw.push(...(data as FfEvent[]));
  }
  if (raw.length === 0) throw new Error("Forex Factory feeds were unreachable.");
  const impactMap = { Low: "low", Medium: "medium", High: "high" } as const;
  return raw
    .map((e, i) => ({
      id: `ff-${i}-${e.date}`,
      iso: e.date,
      currency: e.country,
      impact: (impactMap[e.impact] ?? "low") as Impact,
      title: e.title,
      actual: e.actual?.trim() || null,
      forecast: e.forecast?.trim() || null,
      previous: e.previous?.trim() || null,
    }))
    .sort((a, b) => a.iso.localeCompare(b.iso));
}

// ── Finnhub (requires Economic-1 paid plan + the configured key) ────────────

interface FinnhubEvent {
  actual?: number | string | null;
  prev?: number | string | null;
  country?: string;
  event?: string;
  estimate?: number | string | null;
  impact?: string;
  time?: string; // YYYY-MM-DD HH:MM:SS
  unit?: string;
}

function finnhubImpact(value: string | undefined): Impact {
  const v = (value ?? "").toLowerCase();
  if (v.includes("high") || v.includes("3")) return "high";
  if (v.includes("medium") || v.includes("2") || v.includes("moderate")) return "medium";
  return "low";
}

function fmtFinnhubValue(value: number | string | null | undefined, unit?: string): string | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? String(value) : value;
  return unit && num !== "0" ? `${num}${unit.startsWith("%") ? "%" : ` ${unit}`}`.trim() : num;
}

async function fetchFinnhub(): Promise<CalendarItem[]> {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) throw new Error("Finnhub calendar requires FINNHUB_API_KEY.");
  // Fetch the next 7 days (Finnhub accepts from/to as YYYY-MM-DD).
  const from = new Date();
  const to = new Date(from.getTime() + 7 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const res = await fetch(
    `https://finnhub.io/api/v1/calendar/economic?from=${fmt(from)}&to=${fmt(to)}&token=${apiKey}`,
    { signal: AbortSignal.timeout(10_000), cache: "no-store" },
  );
  if (res.status === 403 || res.status === 401) {
    throw new Error("Your Finnhub plan does not include the economic calendar (requires the Economic-1 add-on).");
  }
  if (!res.ok) throw new Error(`Finnhub calendar returned ${res.status}.`);
  const body = (await res.json()) as FinnhubEvent[] | { economicCalendar?: FinnhubEvent[] };
  const events = Array.isArray(body) ? body : body.economicCalendar ?? [];
  if (events.length === 0) throw new Error("Finnhub returned no economic events for this week.");
  return events
    .map((e, i) => ({
      id: `fh-${i}-${e.time ?? ""}`,
      iso: e.time ?? "",
      currency: (e.country ?? "").slice(0, 3).toUpperCase(),
      impact: finnhubImpact(e.impact),
      title: e.event ?? "Economic event",
      actual: fmtFinnhubValue(e.actual, e.unit),
      forecast: fmtFinnhubValue(e.estimate, e.unit),
      previous: fmtFinnhubValue(e.prev, e.unit),
    }))
    .filter((e) => e.iso)
    .sort((a, b) => a.iso.localeCompare(b.iso));
}

// ── Route ───────────────────────────────────────────────────────────────────

/**
 * GET /api/economic-calendar?scope=week&impact=high&currencies=USD,EUR
 *
 * Source is selected by ECONOMIC_CALENDAR_SOURCE:
 *   - "finnhub"      → Finnhub /calendar/economic (requires Economic-1 paid plan)
 *   - "forexfactory" → Forex Factory public JSON (default; free, rate-limited)
 *
 * Result is Redis-cached for 30 minutes. Empty/error results are never cached.
 * On upstream failure a previously cached result is served, otherwise a 502.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scopeToday = url.searchParams.get("scope") === "today";
  const impactParam = url.searchParams.get("impact"); // "low" | "medium" | "high" | null (all)
  const currenciesParam = url.searchParams.get("currencies"); // "USD,EUR" | null (all)
  const source = calendarSource();

  const cacheKey = `economic-calendar:${source}:${scopeToday ? "today" : "week"}:${impactParam ?? "all"}:${currenciesParam ?? "all"}`;
  const cached = await cacheGet<CalendarItem[]>(cacheKey);

  try {
    const all = source === "finnhub" ? await fetchFinnhub() : await fetchForexFactory();
    let items = all;

    if (impactParam && ["low", "medium", "high"].includes(impactParam)) {
      items = items.filter((e) => e.impact === impactParam);
    }
    if (currenciesParam) {
      const wanted = new Set(currenciesParam.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean));
      items = items.filter((e) => wanted.has(e.currency));
    }
    if (scopeToday) {
      const today = new Date().toISOString().slice(0, 10);
      items = items.filter((e) => e.iso.slice(0, 10) === today);
    }

    // Only cache genuinely populated results so a throttled/empty response
    // never poisons the cache.
    if (items.length > 0) await cacheSet(cacheKey, items, CACHE_TTL_SECONDS);
    return NextResponse.json({ items, source, asOf: new Date().toISOString() });
  } catch (error) {
    console.error(`Economic calendar fetch (${source}) failed`, error);
    if (cached && cached.length > 0) return NextResponse.json({ items: cached, source, cached: true });
    const message = error instanceof Error ? error.message : "Unable to reach the economic calendar source.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
