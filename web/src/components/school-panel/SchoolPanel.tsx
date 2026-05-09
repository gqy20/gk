"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import SchoolHeader from "./SchoolHeader";
import TabNav, { type TabKey } from "./TabNav";
import OverviewSection from "./OverviewSection";
import DetailSection from "./DetailSection";
import type { School, UniversityInfo } from "@/lib/data";
import { CATEGORY_LABELS, DETAIL_CATEGORIES } from "@/lib/data";
import type { CrawlStatusMap, CrawlSourcesMap } from "@/lib/crawl-data";

interface SchoolPanelProps {
  school: School | null;
  onClose?: () => void;
  crawlStatus?: CrawlStatusMap | null;
  crawlSources?: CrawlSourcesMap | null;
}

/** 安全获取详情字段的数据条数 */
function getDetailCount(detail: UniversityInfo | undefined, key: string): number | undefined {
  if (!detail) return undefined;
  const val = (detail as unknown as Record<string, unknown>)[key];
  if (Array.isArray(val)) return val.length;
  if (key === "basic_info" && detail.basic_info) return 1;
  if (key === "major_satisfaction" && detail.major_satisfaction) return detail.major_satisfaction.length;
  return undefined;
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
        count: getDetailCount(detail, key),
      })),
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
  const [contentVisible, setContentVisible] = useState(true);
  const prevTabRef = useRef(activeTab);

  // Tab 切换时淡出 → 切内容 → 淡入
  useEffect(() => {
    if (prevTabRef.current !== activeTab && prevTabRef.current !== null) {
      setContentVisible(false);
      const timer = setTimeout(() => setContentVisible(true), 200);
      return () => clearTimeout(timer);
    }
    prevTabRef.current = activeTab;
  }, [activeTab]);

  return (
    <div className="flex h-full flex-col bg-surface-light text-text-light">
      <SchoolHeader
        school={school}
        onClose={onClose}
      />
      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 transition-opacity duration-200",
          contentVisible ? "opacity-100" : "opacity-0",
        )}
      >
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
