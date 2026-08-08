"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArticleLayout } from "@/components/landing/ArticleLayout";
import { VodBanner } from "@/components/landing/VodBanner";
import { VideoPlayer } from "@/components/education/VideoPlayer";

interface Lesson { n: number; duration: string; youtubeId: string; key: string; }
interface Module { titleKey: string; lessons: Lesson[]; }

const MODULES: Module[] = [
  {
    titleKey: "m1Title",
    lessons: [
      { n: 1, key: "l1", duration: "10:12", youtubeId: "bBC-nXj3Ng4" },
      { n: 2, key: "l2", duration: "8:48", youtubeId: "GWelSpdKwCw" },
      { n: 3, key: "l3", duration: "9:30", youtubeId: "Ily1gN-yrfI" },
    ],
  },
  {
    titleKey: "m2Title",
    lessons: [
      { n: 4, key: "l4", duration: "11:05", youtubeId: "ZwL11tUfeXg" },
      { n: 5, key: "l5", duration: "10:22", youtubeId: "GWelSpdKwCw" },
      { n: 6, key: "l6", duration: "9:14", youtubeId: "Ily1gN-yrfI" },
    ],
  },
  {
    titleKey: "m3Title",
    lessons: [
      { n: 7, key: "l7", duration: "8:40", youtubeId: "ZwL11tUfeXg" },
      { n: 8, key: "l8", duration: "10:55", youtubeId: "bBC-nXj3Ng4" },
      { n: 9, key: "l9", duration: "9:08", youtubeId: "GWelSpdKwCw" },
    ],
  },
];

export default function CryptoVodsPage() {
  const t = useTranslations("cryptoVod");
  const [active, setActive] = useState<{ id: string; title: string } | null>(null);

  return (
    <ArticleLayout eyebrow={t("eyebrow")} title={t("title")} description={t("description")}>
      <VodBanner stat={t("stat")}>{t("bannerBody")}</VodBanner>
      {MODULES.map((mod) => (
        <div key={mod.titleKey}>
          <h2 className="text-lg font-bold mb-3">{t(mod.titleKey)}</h2>
          <div className="space-y-2 not-prose">
            {mod.lessons.map((l) => (
              <button
                key={l.n}
                type="button"
                onClick={() => setActive({ id: l.youtubeId, title: t(`${l.key}t`) })}
                className="flex w-full items-center gap-4 bg-canvas border border-border rounded-xl p-4 hover:shadow-card transition text-left"
              >
                <div className="h-12 w-20 rounded-lg bg-panel-2 border border-border flex items-center justify-center text-text-faint shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-faint tnum">{t("lessonLabel")} {l.n}</span>
                    <span className="text-[11px] text-text-faint">·</span>
                    <span className="text-[11px] text-text-faint tnum">{l.duration}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-text">{t(`${l.key}t`)}</h3>
                  <p className="text-xs text-text-muted mt-0.5 truncate">{t(`${l.key}d`)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
      <VideoPlayer videoId={active?.id ?? null} title={active?.title ?? ""} open={active !== null} onClose={() => setActive(null)} />
    </ArticleLayout>
  );
}
