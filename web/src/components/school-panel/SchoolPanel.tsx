"use client";

import { useMemo, useState } from "react";
import SchoolHeader from "./SchoolHeader";
import TabNav, { type TabKey } from "./TabNav";
import OverviewSection from "./OverviewSection";
import DetailSection from "./DetailSection";
import type { School } from "@/lib/data";
import { CATEGORY_LABELS, DETAIL_CATEGORIES } from "@/lib/data";
import type { CrawlStatusMap, CrawlSourcesMap } from "@/lib/crawl-data";

interface SchoolPanelProps {
  school: School | null;
  onClose?: () => void;
  crawlStatus?: CrawlStatusMap | null;
  crawlSources?: CrawlSourcesMap | null;
}

export default function SchoolPanel({
  school,
  onClose,
  crawlStatus,
  crawlSources,
}: SchoolPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [activeCrawlCategory, setActiveCrawlCategory] = useState<string | null>(null);

  const detail = school?.detail;

  function handleCategoryClick(category: string) {
    if (activeTab !== "overview") setActiveTab("overview");
    setActiveCrawlCategory((prev) => (prev === category ? null : category));
  }

  const tabs = useMemo(() => {
    const allTabs: { key: TabKey; label: string; count?: number }[] = [
      { key: "overview", label: "概览" },
      ...DETAIL_CATEGORIES.map((key) => ({
        key,
        label: CATEGORY_LABELS[key],
        count: detail?.[key]?.length ?? 0,
      })),
      {
        key: "colleges",
        label: CATEGORY_LABELS.colleges,
        count: detail?.colleges?.length ?? 0,
      },
      {
        key: "student_experiences",
        label: CATEGORY_LABELS.student_experiences,
        count: detail?.student_experiences?.length ?? 0,
      },
    ];

    return allTabs.filter((tab) => {
      if (tab.key === "overview") return true;
      if (!detail) return false;
      const items = detail[tab.key as keyof typeof detail];
      return Array.isArray(items) && items.length > 0;
    });
  }, [detail]);

  if (!school) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-dark-600">
        选择学校查看详情
      </div>
    );
  }

  const isOverview = activeTab === "overview";

  return (
    <div className="flex h-full flex-col bg-surface-light text-text-light">
      <SchoolHeader
        school={school}
        onClose={onClose}
        crawlStatus={crawlStatus}
        onCategoryClick={handleCategoryClick}
        activeCrawlCategory={activeCrawlCategory}
      />
      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {isOverview ? (
          <OverviewSection
            detail={detail}
            school={school}
            crawlStatus={crawlStatus}
            crawlSources={crawlSources}
            activeCrawlCategory={activeCrawlCategory}
            onCategoryClick={handleCategoryClick}
          />
        ) : detail ? (
          <DetailSection
            category={activeTab}
            detail={detail}
            crawlSources={crawlSources?.[school.name]}
          />
        ) : (
          <p className="text-sm text-dark-600">暂无数据</p>
        )}
      </div>
    </div>
  );
}
