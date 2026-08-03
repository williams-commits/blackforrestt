"use client";

import { useState } from "react";
import { ArticleLayout } from "@/components/landing/ArticleLayout";
import { VideoPlayer } from "@/components/education/VideoPlayer";

interface Lesson {
  n: number;
  title: string;
  duration: string;
  description: string;
  youtubeId: string;
}

// NOTE: youtubeId values are verified-real placeholders. Swap them for your
// brand's own course content; the player + structure are functional regardless.
const MODULES: { title: string; lessons: Lesson[] }[] = [
  {
    title: "Module 1 — The Basics",
    lessons: [
      { n: 1, title: "Welcome to the markets", duration: "7:24", description: "What trading is, how brokers work, and what to expect on your journey.", youtubeId: "GWelSpdKwCw" },
      { n: 2, title: "Reading a price chart", duration: "9:10", description: "Candlesticks explained — open, high, low, close, and what they tell you.", youtubeId: "Ily1gN-yrfI" },
      { n: 3, title: "Pips, lots, and leverage", duration: "8:42", description: "The vocabulary of trading, demystified with worked examples.", youtubeId: "ZwL11tUfeXg" },
    ],
  },
  {
    title: "Module 2 — Your First Trades",
    lessons: [
      { n: 4, title: "Placing a trade in the platform", duration: "6:55", description: "A full walkthrough: pick a symbol, set size, buy or sell, manage the position.", youtubeId: "Ily1gN-yrfI" },
      { n: 5, title: "Using stop-loss and take-profit", duration: "8:03", description: "Why every trade needs an exit plan, and how to set it before you enter.", youtubeId: "GWelSpdKwCw" },
      { n: 6, title: "Reading your P&L", duration: "5:30", description: "Floating vs. realized profit, margin, and what the numbers mean.", youtubeId: "ZwL11tUfeXg" },
    ],
  },
  {
    title: "Module 3 — Risk Management",
    lessons: [
      { n: 7, title: "The 1% rule", duration: "7:15", description: "The single most important habit for surviving your first year.", youtubeId: "GWelSpdKwCw" },
      { n: 8, title: "Position sizing in practice", duration: "9:48", description: "How to calculate lot size from your stop distance and risk budget.", youtubeId: "Ily1gN-yrfI" },
      { n: 9, title: "Your first trading journal", duration: "6:20", description: "Building the habit that separates winners from gamblers.", youtubeId: "ZwL11tUfeXg" },
    ],
  },
];

export default function BeginnersVodsPage() {
  const [active, setActive] = useState<{ id: string; title: string } | null>(null);

  return (
    <ArticleLayout
      eyebrow="Education"
      title="Beginners Video Courses"
      description="Watch and learn at your own pace. Nine bite-sized lessons that take you from zero to your first confident, well-managed trade."
    >
      <div className="flex items-center gap-4 bg-brand-soft border border-brand/30 rounded-xl p-4 not-prose">
        <div className="text-3xl">🎬</div>
        <div>
          <div className="text-sm font-semibold text-text">9 lessons · ~69 minutes total</div>
          <div className="text-xs text-text-muted">Short, focused videos — 5 to 10 minutes each. Click any lesson to play.</div>
        </div>
      </div>

      {MODULES.map((mod) => (
        <div key={mod.title}>
          <h2 className="text-lg font-bold mb-3">{mod.title}</h2>
          <div className="space-y-2 not-prose">
            {mod.lessons.map((l) => (
              <button
                key={l.n}
                type="button"
                onClick={() => setActive({ id: l.youtubeId, title: l.title })}
                className="flex w-full items-center gap-4 bg-canvas border border-border rounded-xl p-4 hover:shadow-card transition text-left"
              >
                <div className="h-12 w-20 rounded-lg bg-panel-2 border border-border flex items-center justify-center text-text-faint shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-faint tnum">Lesson {l.n}</span>
                    <span className="text-[11px] text-text-faint">·</span>
                    <span className="text-[11px] text-text-faint tnum">{l.duration}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-text">{l.title}</h3>
                  <p className="text-xs text-text-muted mt-0.5 truncate">{l.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <VideoPlayer
        videoId={active?.id ?? null}
        title={active?.title ?? ""}
        open={active !== null}
        onClose={() => setActive(null)}
      />
    </ArticleLayout>
  );
}
