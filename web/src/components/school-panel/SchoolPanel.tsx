"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { EMPTY_MESSAGES } from "@/lib/constants";
import SchoolHeader from "./SchoolHeader";
import TabNav, { type ResourceTabKey, type TabKey } from "./TabNav";
import OverviewSection from "./OverviewSection";
import DetailSection from "./DetailSection";
import type { School, UniversityInfo } from "@/lib/data";
import { CATEGORY_LABELS, DETAIL_CATEGORIES } from "@/lib/data";
import type { CrawlStatusMap, CrawlSourcesMap, SourceItem } from "@/lib/crawl-data";

interface SchoolPanelProps {
  school: School | null;
  onClose?: () => void;
  futureHref?: string;
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
  futureHref,
  crawlSources,
}: SchoolPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [activeResourceCategory, setActiveResourceCategory] = useState<ResourceTabKey | null>(null);
  const [contentVisible, setContentVisible] = useState(true);
  const prevTabRef = useRef(activeTab);

  const detail = school?.detail;
  const schoolSources = school ? crawlSources?.[school.name] : undefined;

  const resourceTabs = useMemo(() => {
    const allTabs = DETAIL_CATEGORIES.map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      count: getDetailCount(detail, key),
    }));

    const detailTabs = allTabs.filter((tab) => {
      if (!detail) return false;
      const items = detail[tab.key as keyof typeof detail];
      return Array.isArray(items) && items.length > 0;
    });

    const campusSourceCount = countCampusSources(schoolSources);
    if (campusSourceCount > 0) {
      return [
        ...detailTabs,
        {
          key: "campus_sources" as const,
          label: "校园来源",
          count: campusSourceCount,
        },
      ];
    }

    return detailTabs;
  }, [detail, schoolSources]);

  const tabs = useMemo(() => {
    const totalResources = resourceTabs.reduce((sum, tab) => sum + (tab.count || 0), 0);
    return [
      { key: "overview" as const, label: "总览" },
      { key: "resources" as const, label: "资料库", count: totalResources || undefined },
    ];
  }, [resourceTabs]);

  useEffect(() => {
    if (activeResourceCategory && resourceTabs.some((tab) => tab.key === activeResourceCategory)) {
      return;
    }
    queueMicrotask(() => setActiveResourceCategory(resourceTabs[0]?.key || null));
  }, [activeResourceCategory, resourceTabs]);

  // Tab 切换时淡出 → 切内容 → 淡入
  useEffect(() => {
    if (prevTabRef.current !== activeTab && prevTabRef.current !== null) {
      setContentVisible(false);
      const timer = setTimeout(() => setContentVisible(true), 200);
      return () => clearTimeout(timer);
    }
    prevTabRef.current = activeTab;
  }, [activeTab]);

  if (!school) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-light-muted">
        {EMPTY_MESSAGES.selectSchool}
      </div>
    );
  }

  const isOverview = activeTab === "overview";
  const resourceCategory = activeResourceCategory || resourceTabs[0]?.key || null;

  function handleResourceSelect(category: ResourceTabKey) {
    setActiveResourceCategory(category);
    setActiveTab("resources");
  }

  return (
    <div className="paper-shell flex h-full flex-col text-text-light">
      <SchoolHeader
        school={school}
        onClose={onClose}
        futureHref={futureHref}
      />
      <TabNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        resourceTabs={resourceTabs}
        activeResourceTab={resourceCategory}
        onResourceTabChange={setActiveResourceCategory}
      />
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
            onResourceSelect={handleResourceSelect}
          />
        ) : detail && resourceCategory ? (
          <DetailSection
            category={resourceCategory}
            detail={detail}
            crawlSources={schoolSources}
          />
        ) : (
          <p className="text-sm text-text-light-muted">暂无数据</p>
        )}
      </div>
    </div>
  );
}

function countCampusSources(sourceMap?: Record<string, SourceItem[]>): number {
  if (!sourceMap) return 0;
  return Object.values(sourceMap).reduce((sum, sources) => sum + sources.length, 0);
}
