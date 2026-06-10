"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SchoolMap from "@/components/school-panel/SchoolMap";
import SchoolPanel from "@/components/school-panel/SchoolPanel";
import type { School } from "@/lib/data";
import type { CrawlSourcesMap } from "@/lib/crawl-data";

interface Props {
  school: School;
}

type MobileView = "map" | "detail";

export default function SchoolDetailClient({ school }: Props) {
  const router = useRouter();
  const [crawlSources, setCrawlSources] = useState<CrawlSourcesMap | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("detail");
  const simulatorHref = `/simulator?school=${encodeURIComponent(school.name)}&province=${encodeURIComponent(school.province)}`;

  useEffect(() => {
    async function loadCrawlData() {
      try {
        const res = await fetch("/data/crawl-sources.json");
        if (!res.ok) return;
        const json = await res.json();
        setCrawlSources(json);
      } catch {
        // ignore
      }
    }
    loadCrawlData();
  }, []);

  return (
    <div className="ink-wash-bg flex h-screen min-h-screen flex-col overflow-hidden text-text">

      {/* Main content */}
      <main className="relative z-10 flex flex-1 gap-2.5 overflow-hidden p-2.5 sm:gap-3 sm:p-3">
        {/* Left: Map + POI — 桌面端始终显示，移动端按切换状态显示 */}
        <section className={`paper-card relative min-h-0 flex-1 overflow-hidden rounded-lg border ${mobileView === "map" ? "flex" : "hidden"} lg:flex`}>
          <SchoolMap school={school} compact={false} />
        </section>

        {/* Right: Detail panel — 桌面端固定宽度，移动端按切换状态显示 */}
        <aside className={`paper-card relative flex w-full min-w-0 max-w-[430px] flex-col overflow-hidden rounded-lg border text-text lg:w-[430px] lg:shrink-0 ${mobileView === "detail" ? "flex" : "hidden"} lg:flex`}>
          <SchoolPanel
            school={school}
            onClose={() => router.push("/")}
            simulatorHref={simulatorHref}
            crawlSources={crawlSources}
          />
        </aside>
      </main>

      {/* 移动端视图切换按钮 — 桌面端隐藏 */}
      <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 lg:hidden">
        <div className="flex items-center gap-1 rounded-md border border-border/60 bg-neutral-0/90 p-1 shadow-lg shadow-neutral-900/8 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setMobileView("detail")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              mobileView === "detail"
                ? "bg-accent-500 text-text-inverse shadow-md"
                : "text-text-light-muted hover:bg-surface-light-subtle"
            }`}
          >
            详情
          </button>
          <button
            type="button"
            onClick={() => setMobileView("map")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              mobileView === "map"
                ? "bg-accent-500 text-text-inverse shadow-md"
                : "text-text-light-muted hover:bg-surface-light-subtle"
            }`}
          >
            地图
          </button>
        </div>
      </div>
    </div>
  );
}
