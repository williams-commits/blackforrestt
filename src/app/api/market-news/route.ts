import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/server/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 60;
const FINNHUB_BASE = "https://finnhub.io/api/v1";

interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

interface NewsItem {
  id: number;
  headline: string;
  source: string;
  url: string;
  summary: string;
  related: string;
  time: number;
  image: string;
}

/**
 * GET /api/market-news?category=general
 * Fetches market news from Finnhub using the configured FINNHUB_API_KEY and
 * Redis-caches the normalized result for 60s to stay within the free-tier
 * rate limit (60 calls/min). Falls back to the cached payload on failure.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category")?.trim() || "general";
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Market news requires a configured FINNHUB_API_KEY." }, { status: 503 });
  }

  const cacheKey = `market-news:${category}`;
  const cached = await cacheGet<NewsItem[]>(cacheKey);
  // Serve fresh-from-cache first: every visitor otherwise pays the upstream
  // round-trip (up to 8s on a slow day) and burns the free-tier rate limit —
  // the cache below was only ever used as a failure fallback.
  if (cached) {
    return NextResponse.json(
      { items: cached, cached: true },
      { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=30" } },
    );
  }

  try {
    const res = await fetch(`${FINNHUB_BASE}/news?category=${encodeURIComponent(category)}&token=${apiKey}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      // On rate-limit/upstream error, serve stale cache if available.
      if (cached) return NextResponse.json({ items: cached, cached: true });
      return NextResponse.json({ error: `News feed returned ${res.status}.` }, { status: 502 });
    }
    const raw = (await res.json()) as FinnhubNewsItem[];
    const items: NewsItem[] = raw.slice(0, 30).map((item) => ({
      id: item.id,
      headline: item.headline,
      source: item.source,
      url: item.url,
      summary: item.summary,
      related: item.related,
      time: item.datetime,
      image: item.image,
    }));
    await cacheSet(cacheKey, items, CACHE_TTL_SECONDS);
    return NextResponse.json({ items, asOf: new Date().toISOString() });
  } catch {
    // Network/timeout — serve stale cache if available, otherwise error.
    if (cached) return NextResponse.json({ items: cached, cached: true });
    return NextResponse.json({ error: "Unable to reach the news feed." }, { status: 502 });
  }
}
