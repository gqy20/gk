"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppProvider, { useApp } from "@/components/AppProvider";
import { Button } from "@/components/ui/Button";
import ChinaMap from "@/components/ChinaMap";
import CompareBar from "@/components/CompareBar";
import ComparePanel from "@/components/ComparePanel";
import FilterBar from "@/components/FilterBar";
import ProvinceList from "@/components/ProvinceList";
import SchoolPanel from "@/components/school-panel/SchoolPanel";
import SchoolMap from "@/components/school-panel/SchoolMap";

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
    }
    load();
  }, [dispatch]);

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface text-sm text-dark-200">
        <motion.span
          className="mr-3 h-2 w-2 rounded-full bg-primary"
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        地图数据加载中
      </div>
    );
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

      <header className="relative z-10 border-b border-border bg-surface/95 px-3 py-2.5 shadow-2xl shadow-black/20 sm:px-4 sm:py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
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

          <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
            <Metric label="高校" value={data.schools.length} />
            <Metric label="已采集" value={doneCount} tone="gold" />
            <Metric label="省份" value={filteredProvinces.length} tone="green" />
          </div>
        </div>

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
      </header>

      <main className="relative z-10 grid flex-1 grid-rows-[minmax(52vh,1fr)_minmax(200px,1fr)] gap-2.5 overflow-hidden p-2.5 sm:gap-3 sm:p-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] lg:grid-rows-1">
        <section aria-label="高校地图" className="relative min-h-0 overflow-hidden rounded-lg border border-border bg-surface-elevated/92 shadow-2xl shadow-black/25">
          {selectedSchool ? (
            <SchoolMap school={selectedSchool} compact={false} />
          ) : (
            <>
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
                onSchoolClick={(s) => dispatch({ type: "SELECT_SCHOOL", payload: s })}
              />
            </>
          )}
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
                  onSchoolClick={(s) => dispatch({ type: "SET_PREVIEW_SCHOOL", payload: s })}
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

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "gold" | "green";
}) {
  const toneClass =
    tone === "gold"
      ? "text-gold-400"
      : tone === "green"
        ? "text-green-200"
        : "text-dark-50";

  return (
    <motion.div
      className="rounded-lg border border-border bg-white/[0.055] px-2.5 py-1.5 sm:px-3 sm:py-2"
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <div className="text-[10px] text-dark-500">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold leading-none ${toneClass}`}>
        {value}
      </div>
    </motion.div>
  );
}
