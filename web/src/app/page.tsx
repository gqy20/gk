"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import AppProvider, { useApp } from "@/components/AppProvider";
import { Button } from "@/components/ui/Button";
import { HomePageSkeleton } from "@/components/ui/Skeleton";
import ChinaMap from "@/components/ChinaMap";
import CompareBar from "@/components/CompareBar";
import ComparePanel from "@/components/ComparePanel";
import FilterBar from "@/components/FilterBar";
import ProvinceList from "@/components/ProvinceList";
import SchoolPanel from "@/components/school-panel/SchoolPanel";

const panelVariants = {
  initial: { x: 24, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -24, opacity: 0 },
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
    doneCount,
    filteredDoneCount,
    activeFilterCount,
    contextLabel,
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

  return (
    <div className="relative flex h-screen min-h-screen flex-col overflow-hidden bg-surface text-text">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:44px_44px]"
      />
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {selectedSchool
          ? `已选择学校：${selectedSchool.name}`
          : selectedProvince
            ? `已选择省份：${selectedProvince}`
            : "显示全国高校"}
      </div>

      <header className="relative z-10 border-b border-border bg-surface/95 px-3 py-2 shadow-2xl shadow-black/20 sm:px-4 sm:py-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <img
                src="/logo.svg"
                alt=""
                className="h-8 w-8 rounded-lg"
                width={32}
                height={32}
              />
              <h1 className="text-2xl font-semibold leading-none text-dark-50 sm:text-3xl">
                中国高校信息地图
              </h1>
              <span className="max-w-full truncate text-xs text-dark-300 sm:text-sm">
                当前：{contextLabel}
              </span>
            </div>
          </div>

          {!selectedSchool && (
            <>
              <FilterBar
                query={query}
                filter985={filter985}
                filter211={filter211}
                filterDoubleFirst={filterDoubleFirst}
                totalCount={data.schools.length}
                filteredCount={filteredSchools.length}
                doneCount={filteredDoneCount}
                provinceCount={filteredProvinces.length}
                activeFilterCount={activeFilterCount}
                onQueryChange={(v) => dispatch({ type: "SET_QUERY", payload: v })}
                onToggle985={() => dispatch({ type: "TOGGLE_FILTER", payload: "985" })}
                onToggle211={() => dispatch({ type: "TOGGLE_FILTER", payload: "211" })}
                onToggleDoubleFirst={() =>
                  dispatch({ type: "TOGGLE_FILTER", payload: "doubleFirst" })
                }
                onReset={() => dispatch({ type: "RESET_FILTERS" })}
              />
            </>
          )}
        </div>
      </header>

      <main className="relative z-10 grid flex-1 grid-rows-[minmax(52vh,1fr)_minmax(200px,1fr)] gap-2.5 overflow-hidden p-2.5 sm:gap-3 sm:p-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] lg:grid-rows-1">
        <section aria-label="高校地图" className="relative min-h-0 overflow-hidden rounded-lg border border-border bg-surface-elevated/92 shadow-2xl shadow-black/25">
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2 text-xs text-dark-300">
            <span className="rounded-full border border-border-subtle bg-white/[0.06] px-3 py-1">
              {filteredSchools.length} 所高校
            </span>
          </div>
          <ChinaMap
            schools={filteredSchools}
            provinces={filteredProvinces}
            selectedProvince={selectedProvince}
            previewSchool={previewSchool}
            onProvinceSelect={(p) => dispatch({ type: "SELECT_PROVINCE", payload: p })}
            onSchoolPreview={(s) => dispatch({ type: "SET_PREVIEW_SCHOOL", payload: s })}
            onSchoolClick={(s) => router.push(`/school/${encodeURIComponent(s.name)}`)}
          />
        </section>

        <aside aria-label="高校列表与详情" className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface-light text-text-light shadow-2xl shadow-black/25">
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
                <div className="border-b border-border-light bg-ink-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text-light">
                        {selectedProvince || "全部省份"}
                      </div>
                    </div>
                    {selectedProvince && (
                      <Button
                        theme="light"
                        variant="secondary"
                        size="sm"
                        onClick={() => dispatch({ type: "SELECT_PROVINCE", payload: null })}
                      >
                        返回全部
                      </Button>
                    )}
                  </div>
                  {loadError && (
                    <div className="mt-2 rounded border border-red-500/30 bg-gold-50 px-2 py-1 text-[11px] text-red-600">
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
        </aside>
      </main>
    </div>
  );
}

