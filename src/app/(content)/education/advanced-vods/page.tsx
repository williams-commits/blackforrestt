"use client";

import { useState } from "react";
import { ArticleLayout } from "@/components/landing/ArticleLayout";
import { VideoPlayer } from "@/components/education/VideoPlayer";

// NOTE: youtubeId values are verified-real placeholders. Swap them for your
// brand's own course content; the player + structure are functional regardless.
interface Lesson { n: number; title: string; duration: string; description: string; youtubeId: string }

const MODULES: { title: string; lessons: Lesson[] }[] = [
  {
    title: "Module 1 — Strategy & Structure",
    lessons: [
      { n: 1, title: "Multi-timeframe analysis", duration: "11:20", description: "Aligning higher-timeframe trends with lower-timeframe entries.", youtubeId: "GWelSpdKwCw" },
      { n: 2, title: "Support, resistance, and supply/demand", duration: "13:45", description: "Beyond lines on a chart — where real orders cluster.", youtubeId: "Ily1gN-yrfI" },
      { n: 3, title: "Trend structure: HH, HL, and breaks", duration: "10:08", description: "Reading the market's footprint and catching trend changes early.", youtubeId: "ZwL11tUfeXg" },
    ],
  },
  {
    title: "Module 2 — Money Management",
    lessons: [
      { n: 4, title: "Position sizing with Kelly", duration: "12:30", description: "Matching trade size to edge, not to your gut.", youtubeId: "Ily1gN-yrfI" },
      { n: 5, title: "Correlation risk in portfolios", duration: "9:52", description: "Why two trades can be one, and how to diversify properly.", youtubeId: "GWelSpdKwCw" },
      { n: 6, title: "Drawdowns and recovery math", duration: "8:15", description: "Why a 50% loss needs a 100% gain to recover — and how to avoid it.", youtubeId: "ZwL11tUfeXg" },
    ],
  },
  {
    title: "Module 3 — Psychology & Process",
    lessons: [
      { n: 7, title: "The professional's routine", duration: "10:40", description: "A pre-market checklist real traders run every day.", youtubeId: "ZwL11tUfeXg" },
      { n: 8, title: "Beating tilt and revenge trading", duration: "11:55", description: "Tools to stop emotion from blowing up your account.", youtubeId: "Ily1gN-yrfI" },
      { n: 9, title: "Reviewing your trades like a pro", duration: "9:18", description: "Turning your journal into a feedback loop that compounds skill.", youtubeId: "GWelSpdKwCw" },
    ],
  },
];

export default function AdvancedVodsPage() {
  const [active, setActive] = useState<{ id: string; title: string } | null>(null);

  return (
    <ArticleLayout
      eyebrow="Education"
      title="Advanced Video Courses"
      description="For traders who already know the basics. Strategy deep-dives, live trade reviews, and the money-management and psychology that separate pros from the rest."
    >
      <div className="flex items-center gap-4 bg-brand-soft border border-brand/30 rounded-xl p-4 not-prose">
        <div className="text-3xl">🎬</div>
        <div>
          <div className="text-sm font-semibold text-text">9 lessons · ~108 minutes total</div>
          <div className="text-xs text-text-muted">Includes real-chart walk-throughs and downloadable strategy checklists.</div>
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
