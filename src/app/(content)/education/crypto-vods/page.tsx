"use client";

import { useState } from "react";
import { ArticleLayout } from "@/components/landing/ArticleLayout";
import { VideoPlayer } from "@/components/education/VideoPlayer";

// NOTE: youtubeId values are verified-real placeholders. Swap them for your
// brand's own course content; the player + structure are functional regardless.
interface Lesson { n: number; title: string; duration: string; description: string; youtubeId: string }

const MODULES: { title: string; lessons: Lesson[] }[] = [
  {
    title: "Module 1 — Crypto Fundamentals",
    lessons: [
      { n: 1, title: "What is a blockchain?", duration: "10:12", description: "The technology underpinning crypto, explained without the hype.", youtubeId: "bBC-nXj3Ng4" },
      { n: 2, title: "Bitcoin vs. altcoins", duration: "8:48", description: "Why BTC is the benchmark and what differentiates the rest.", youtubeId: "GWelSpdKwCw" },
      { n: 3, title: "Wallets, keys, and custody", duration: "9:30", description: "Self-custody vs. broker-held — the security trade-offs.", youtubeId: "Ily1gN-yrfI" },
    ],
  },
  {
    title: "Module 2 — Trading Crypto",
    lessons: [
      { n: 4, title: "Reading crypto market structure", duration: "11:05", description: "How crypto charts differ from forex and what stays the same.", youtubeId: "ZwL11tUfeXg" },
      { n: 5, title: "Volatility & position sizing", duration: "10:22", description: "Crypto's wild swings demand smaller sizes — here's the math.", youtubeId: "GWelSpdKwCw" },
      { n: 6, title: "Spot vs. perpetual futures", duration: "9:14", description: "Leverage, funding rates, and liquidation risk explained.", youtubeId: "Ily1gN-yrfI" },
    ],
  },
  {
    title: "Module 3 — Avoiding the Traps",
    lessons: [
      { n: 7, title: "Recognising scams and rug pulls", duration: "8:40", description: "Red flags that separate legitimate projects from disasters.", youtubeId: "ZwL11tUfeXg" },
      { n: 8, title: "The halving and cycle dynamics", duration: "10:55", description: "Bitcoin's 4-year cycle and how it influences the whole market.", youtubeId: "bBC-nXj3Ng4" },
      { n: 9, title: "Building a crypto trading plan", duration: "9:08", description: "Adapting the classic trading plan for 24/7 crypto markets.", youtubeId: "GWelSpdKwCw" },
    ],
  },
];

export default function CryptoVodsPage() {
  const [active, setActive] = useState<{ id: string; title: string } | null>(null);

  return (
    <ArticleLayout
      eyebrow="Education"
      title="Cryptocurrency Video Courses"
      description="Understand digital assets before you trade them. From how blockchains work to reading crypto-specific market structure and avoiding the industry's many traps."
    >
      <div className="flex items-center gap-4 bg-brand-soft border border-brand/30 rounded-xl p-4 not-prose">
        <div className="text-3xl">🎬</div>
        <div>
          <div className="text-sm font-semibold text-text">9 lessons · ~97 minutes total</div>
          <div className="text-xs text-text-muted">No prior crypto knowledge required — start from the basics.</div>
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
