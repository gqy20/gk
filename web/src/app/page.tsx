"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import AppProvider, { useApp } from "@/components/AppProvider";
import { Button } from "@/components/ui/Button";
import { HomePageSkeleton } from "@/components/ui/Skeleton";
import ChinaMap from "@/components/ChinaMap";
import CompareBar from "@/components/CompareBar";
import ComparePanel from "@/components/ComparePanel";
import FilterBar from "@/components/FilterBar";
import { HeaderBlessing, PanelBlessing } from "@/components/GaokaoBlessing";
import ProvinceList from "@/components/ProvinceList";
import SchoolPanel from "@/components/school-panel/SchoolPanel";

const panelVariants = {
  initial: { x: 24, y: 8, opacity: 0, scale: 0.98 },
  animate: { x: 0, y: 0, opacity: 1, scale: 1 },
  exit: { x: -24, y: -4, opacity: 0, scale: 0.98 },
};

const panelTransition = {
  type: "spring" as const,
  stiffness: 320,
  damping: 30,
};

export default function HomePage() {
  return (
    <AppProvider>
      <Home />
    </AppProvider>
  );
}

function Home() {
  const router = useRouter();
  const {
    data,
    loadError,
    selectedProvince,
    selectedSchool,
    previewSchool,
    compareSchools,
    compareOpen,
    query,
    filter985,
    filter211,
    filterDoubleFirst,
    filteredSchools,
    filteredProvinces,
    activeFilterCount,
    crawlStatus,
    crawlSources,
    dispatch,
  } = useApp();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/data/schools.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        dispatch({ type: "SET_DATA", payload: json });
      } catch (error) {
        dispatch({
          type: "SET_LOAD_ERROR",
          payload: error instanceof Error ? error.message : "未知错误",
        });
        dispatch({ type: "SET_DATA", payload: { schools: [], provinces: [] } });
      }

      // 并行加载采集数据（静默失败）
      const crawlFetches = await Promise.allSettled([
        { action: "SET_CRAWL_STATUS" as const, url: "/data/crawl-status.json" },
        { action: "SET_CRAWL_SOURCES" as const, url: "/data/crawl-sources.json" },
        { action: "SET_CRAWL_RUNS" as const, url: "/data/crawl-runs.json" },
      ].map(async ({ action, url }) => {
        const res = await fetch(url);
        return { action, res };
      }));

      for (const entry of crawlFetches) {
        if (entry.status === "fulfilled" && entry.value.res.ok) {
          try {
            const json = await entry.value.res.json();
            dispatch({ type: entry.value.action, payload: json });
          } catch {
            // ignore parse errors
          }
        }
      }
    }
    load();
  }, [dispatch]);

  if (!data) {
    return <HomePageSkeleton />;
  }

  const hasActiveSearch = query.trim().length > 0;
  const shouldShowSidePanel =
    compareOpen ||
    compareSchools.length > 0 ||
    selectedSchool ||
    selectedProvince ||
    hasActiveSearch ||
    activeFilterCount > 0 ||
    loadError;

  return (
    <div className="ink-wash-bg relative flex h-screen min-h-screen flex-col overflow-hidden text-text">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_18%_20%,rgba(82,115,105,0.10),transparent_22%),radial-gradient(circle_at_86%_76%,rgba(68,150,166,0.12),transparent_24%),repeating-linear-gradient(97deg,rgba(83,72,56,0.035)_0_1px,transparent_1px_18px)]"
      />
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {selectedSchool
          ? `已选择学校：${selectedSchool.name}`
          : selectedProvince
            ? `已选择省份：${selectedProvince}`
            : "显示全国高校"}
      </div>

      <header className="paper-shell relative z-20 px-3 py-2 shadow-[0_16px_36px_rgba(235,227,211,0.38)] sm:px-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2.5">
            <Image
              src="/logo.svg"
              alt=""
              className="h-8 w-8 shrink-0 rounded-md ring-1 ring-border/80"
              width={28}
              height={28}
            />
            <div className="min-w-0">
              <h1 className="min-w-0 truncate text-[19px] font-semibold leading-tight text-text sm:text-[21px]">
                中国高校信息地图
              </h1>
            </div>
            <HeaderBlessing />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
            <FilterBar
              query={query}
              activeFilterCount={activeFilterCount}
              onQueryChange={(v) => dispatch({ type: "SET_QUERY", payload: v })}
              onReset={() => dispatch({ type: "RESET_FILTERS" })}
            />
            <a
              href="/majors"
              className="hidden shrink-0 items-center gap-1.5 rounded-md border border-primary/25 bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary transition-all hover:border-primary/50 hover:bg-primary/20 lg:inline-flex"
            >
              专业库
            </a>
            <a
              href="/future"
              className="hidden shrink-0 items-center rounded-md border border-brand-500/25 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-600 transition-all hover:border-brand-500/45 hover:bg-brand-100 lg:inline-flex"
            >
              未来路径
            </a>
          </div>
        </div>
      </header>

      <main
        className={`relative z-10 -mt-1 grid flex-1 gap-2.5 overflow-hidden p-2.5 pt-2 sm:gap-3 sm:p-3 sm:pt-2.5 ${
          shouldShowSidePanel
            ? "grid-rows-[minmax(52vh,1fr)_minmax(200px,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] lg:grid-rows-1"
            : "grid-rows-1"
        }`}
      >
        <section aria-label="高校地图" className="paper-card home-map-card relative min-h-0 overflow-hidden rounded-lg before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-4 before:bg-gradient-to-b before:from-[rgba(247,241,228,0.28)] before:to-transparent">
          <ChinaMap
            schools={data.schools}
            highlightedSchools={filteredSchools}
            provinces={filteredProvinces}
            selectedProvince={selectedProvince}
            previewSchool={previewSchool}
            hasActiveMapFilters={activeFilterCount > 0 || query.trim().length > 0}
            filter985={filter985}
            filter211={filter211}
            filterDoubleFirst={filterDoubleFirst}
            onProvinceSelect={(p) => dispatch({ type: "SELECT_PROVINCE", payload: p })}
            onSchoolPreview={(s) => dispatch({ type: "SET_PREVIEW_SCHOOL", payload: s })}
            onSchoolClick={(s) => router.push(`/school/${encodeURIComponent(s.name)}`)}
            onToggle985={() => dispatch({ type: "TOGGLE_FILTER", payload: "985" })}
            onToggle211={() => dispatch({ type: "TOGGLE_FILTER", payload: "211" })}
            onToggleDoubleFirst={() =>
              dispatch({ type: "TOGGLE_FILTER", payload: "doubleFirst" })
            }
          />
        </section>

        <AnimatePresence mode="wait">
          {shouldShowSidePanel && (
            <motion.aside
              key="side-panel"
              aria-label="高校列表与详情"
              className="paper-card relative flex min-h-0 flex-col overflow-hidden rounded-lg border text-text"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={panelTransition}
            >
              <AnimatePresence mode="wait">
                {compareOpen ? (
                  <motion.div
                    key="compare"
                    className="flex min-h-0 flex-1 flex-col"
                    variants={panelVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={panelTransition}
                  >
                    <ComparePanel
                      schools={compareSchools}
                      onClose={() => dispatch({ type: "SET_COMPARE_OPEN", payload: false })}
                      onRemove={(s) => dispatch({ type: "REMOVE_COMPARE", payload: s })}
                    />
                  </motion.div>
                ) : selectedSchool ? (
                  <motion.div
                    key="school"
                    className="flex min-h-0 flex-1 flex-col"
                    variants={panelVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={panelTransition}
                  >
                    <SchoolPanel
                      key={selectedSchool.name}
                      school={selectedSchool}
                      onClose={() => dispatch({ type: "SELECT_SCHOOL", payload: null })}
                      crawlStatus={crawlStatus}
                      crawlSources={crawlSources}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="list"
                    className="flex min-h-0 flex-1 flex-col"
                    variants={panelVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={panelTransition}
                  >
                    <div className="border-b border-border-light bg-accent-50/45 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-text-light">
                            {selectedProvince ?? "筛选结果"}
                          </div>
                          {!selectedProvince && (
                            <div className="mt-0.5 text-xs text-text-light-muted">
                              {filteredSchools.length} 所高校
                            </div>
                          )}
                        </div>
                        <PanelBlessing className="hidden max-w-[188px] sm:flex" />
                        {(selectedProvince || hasActiveSearch || activeFilterCount > 0) && (
                          <Button
                            theme="light"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              if (selectedProvince) {
                                dispatch({ type: "SELECT_PROVINCE", payload: null });
                              }
                              if (hasActiveSearch || activeFilterCount > 0) {
                                dispatch({ type: "RESET_FILTERS" });
                              }
                            }}
                          >
                            返回全国
                          </Button>
                        )}
                      </div>
                      {loadError && (
                        <div className="mt-2 rounded border border-danger-500/30 bg-accent-50 px-2 py-1 text-[11px] text-danger-600">
                          数据加载失败：{loadError}
                        </div>
                      )}
                    </div>
                    <ProvinceList
                      provinces={filteredProvinces}
                      selectedProvince={selectedProvince}
                      selectedSchool={selectedSchool}
                      compareSchools={compareSchools}
                      onProvinceClick={(p) => dispatch({ type: "SELECT_PROVINCE", payload: p })}
                      onSchoolClick={(s) => router.push(`/school/${encodeURIComponent(s.name)}`)}
                      onCompareToggle={(s) => dispatch({ type: "TOGGLE_COMPARE", payload: s })}
                    />
                    <CompareBar
                      schools={compareSchools}
                      onRemove={(s) => dispatch({ type: "REMOVE_COMPARE", payload: s })}
                      onCompare={() => dispatch({ type: "SET_COMPARE_OPEN", payload: true })}
                      onClear={() => dispatch({ type: "CLEAR_COMPARE" })}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
