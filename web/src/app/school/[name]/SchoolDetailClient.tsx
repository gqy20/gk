"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SchoolMap from "@/components/school-panel/SchoolMap";
import SchoolPanel from "@/components/school-panel/SchoolPanel";
import type { School } from "@/lib/data";
import type {
  CrawlStatusMap,
  CrawlSourcesMap,
  RunRecord,
} from "@/lib/crawl-data";

interface Props {
  school: School;
}

type MobileView = "map" | "detail";

export default function SchoolDetailClient({ school }: Props) {
  const router = useRouter();
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatusMap | null>(null);
  const [crawlSources, setCrawlSources] = useState<CrawlSourcesMap | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("detail");

  useEffect(() => {
    async function loadCrawlData() {
      try {
        const [statusRes, sourcesRes] = await Promise.allSettled([
          fetch("/data/crawl-status.json"),
          fetch("/data/crawl-sources.json"),
        ]);

        if (statusRes.status === "fulfilled" && statusRes.value.ok) {
          try {
            const json = await statusRes.value.json();
            setCrawlStatus(json);
          } catch {
            // ignore
          }
        }
        if (sourcesRes.status === "fulfilled" && sourcesRes.value.ok) {
          try {
            const json = await sourcesRes.value.json();
            setCrawlSources(json);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }
    loadCrawlData();
  }, []);

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-surface text-text">

      {/* Main content */}
      <main className="relative z-10 grid flex-1 gap-2.5 overflow-hidden p-2.5 sm:gap-3 sm:p-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)]">
        {/* Left: Map + POI — 桌面端始终显示，移动端按切换状态显示 */}
        <section className={`relative min-h-0 overflow-hidden rounded-lg border border-border bg-surface-elevated/92 shadow-2xl shadow-black/25 ${mobileView === "map" ? "flex" : "hidden"} lg:flex`}>
          <SchoolMap school={school} />
        </section>

        {/* Right: Detail panel — 桌面端始终显示，移动端按切换状态显示 */}
        <aside className={`relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface-light text-text-light shadow-2xl shadow-black/25 ${mobileView === "detail" ? "flex" : "hidden"} lg:flex`}>
          <SchoolPanel
            school={school}
            onClose={() => router.push("/")}
            crawlStatus={crawlStatus}
            crawlSources={crawlSources}
          />
        </aside>
      </main>

      {/* 移动端视图切换按钮 — 桌面端隐藏 */}
      <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 lg:hidden">
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-surface-light/90 p-1 shadow-lg shadow-black/15 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setMobileView("detail")}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              mobileView === "detail"
                ? "bg-gold-500 text-white shadow-md"
                : "text-dark-600 hover:bg-ink-100"
            }`}
          >
            <span>📋</span> 详情
          </button>
          <button
            type="button"
            onClick={() => setMobileView("map")}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              mobileView === "map"
                ? "bg-gold-500 text-white shadow-md"
                : "text-dark-600 hover:bg-ink-100"
            }`}
          >
            <span>🗺️</span> 地图
          </button>
        </div>
      </div>
    </div>
  );
}
