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

export default function SchoolDetailClient({ school }: Props) {
  const router = useRouter();
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatusMap | null>(null);
  const [crawlSources, setCrawlSources] = useState<CrawlSourcesMap | null>(null);

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
        {/* Left: Map + POI — 移动端紧凑高度，桌面端正常 */}
        <section className="relative min-h-0 overflow-hidden rounded-lg border border-border bg-surface-elevated/92 shadow-2xl shadow-black/25 sm:max-h-[55%] lg:max-h-full">
          <SchoolMap school={school} />
        </section>

        {/* Right: Detail panel */}
        <aside className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface-light text-text-light shadow-2xl shadow-black/25">
          <SchoolPanel
            school={school}
            onClose={() => router.push("/")}
            crawlStatus={crawlStatus}
            crawlSources={crawlSources}
          />
        </aside>
      </main>
    </div>
  );
}
