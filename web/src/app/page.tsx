"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import AppProvider, { useApp } from "@/components/AppProvider";
import { Button } from "@/components/ui/Button";
import { HomePageSkeleton } from "@/components/ui/Skeleton";
import ChinaMap3D from "@/components/ChinaMap3D";
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
      <Suspense fallback={<HomePageSkeleton />}>
        <Home />
      </Suspense>
    </AppProvider>
  );
}

function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    crawlSources,
    dispatch,
  } = useApp();
  const [mapTransitioning, setMapTransitioning] = useState(false);
  const [transitionProvince, setTransitionProvince] = useState<string | null>(null);
  const provinceFromUrl = searchParams.get("province")?.trim() || null;
  const pendingProvinceUrlRef = useRef<string | null | undefined>(undefined);

  const setProvinceUrl = useCallback((province: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (province) {
      params.set("province", province);
    } else {
      params.delete("province");
    }
    const queryString = params.toString();
    const nextHref = queryString ? `${pathname}?${queryString}` : pathname;
    window.history.replaceState(window.history.state, "", nextHref);
    router.replace(nextHref, { scroll: false });
  }, [pathname, router, searchParams]);

  const setProvince = useCallback((province: string | null) => {
    pendingProvinceUrlRef.current = province;
    setTransitionProvince(province ?? selectedProvince);
    dispatch({ type: "SET_PROVINCE", payload: province });
    setProvinceUrl(province);
  }, [dispatch, selectedProvince, setProvinceUrl]);

  const handleMapTransitionChange = useCallback((transitioning: boolean) => {
    setMapTransitioning(transitioning);
    if (!transitioning && !selectedProvince) {
      setTransitionProvince(null);
    }
  }, [selectedProvince]);

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

      // 来源明细较大，选中学校后再加载。
    }
    load();
  }, [dispatch]);

  useEffect(() => {
    if (!selectedSchool || crawlSources) return;
    let cancelled = false;

    async function loadCrawlSources() {
      try {
        const res = await fetch("/data/crawl-sources.json");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          dispatch({ type: "SET_CRAWL_SOURCES", payload: json });
        }
      } catch {
        // 来源明细只用于资料库补充信息，失败不阻断详情浏览。
      }
    }

    void loadCrawlSources();
    return () => {
      cancelled = true;
    };
  }, [crawlSources, dispatch, selectedSchool]);

  useEffect(() => {
    const pendingProvince = pendingProvinceUrlRef.current;
    if (pendingProvince !== undefined) {
      if (provinceFromUrl === pendingProvince) {
        pendingProvinceUrlRef.current = undefined;
      } else if (selectedProvince === pendingProvince) {
        setProvinceUrl(pendingProvince);
        return;
      }
    }
    if (provinceFromUrl === selectedProvince) return;
    dispatch({ type: "SET_PROVINCE", payload: provinceFromUrl });
  }, [dispatch, provinceFromUrl, selectedProvince, setProvinceUrl]);

  if (!data) {
    return <HomePageSkeleton />;
  }

  const hasActiveSearch = query.trim().length > 0;
  const visibleProvince = selectedProvince ?? transitionProvince;
  const hasSidePanelContent =
    compareOpen ||
    compareSchools.length > 0 ||
    selectedSchool ||
    visibleProvince ||
    hasActiveSearch ||
    activeFilterCount > 0 ||
    loadError;
  const shouldReserveSidePanel = mapTransitioning || hasSidePanelContent;

  return (
    <div className="ink-wash-bg relative flex h-screen min-h-screen flex-col overflow-hidden text-text">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_18%_20%,rgba(82,115,105,0.10),transparent_22%),radial-gradient(circle_at_86%_76%,rgba(68,150,166,0.12),transparent_24%),repeating-linear-gradient(97deg,rgba(83,72,56,0.035)_0_1px,transparent_1px_18px)]"
      />
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {selectedSchool
          ? `已选择学校：${selectedSchool.name}`
          : visibleProvince
            ? `已选择省份：${visibleProvince}`
            : "显示全国高校"}
      </div>

      <header className="paper-shell home-topbar relative z-20 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="brand-lockup min-w-0">
            <span className="brand-mark-frame" aria-hidden="true">
              <Image
                src="/logo.svg"
                alt=""
                className="h-7 w-7 shrink-0 rounded-md"
                width={28}
                height={28}
                priority
              />
            </span>
            <div className="min-w-0 leading-none">
              <h1 className="brand-title min-w-0 truncate">
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
              className="home-nav-pill hidden lg:inline-flex"
            >
              专业库
            </a>
            <a
              href="/future"
              className="home-nav-pill hidden lg:inline-flex"
            >
              未来路径
            </a>
            <a
              href="/simulator"
              className="home-nav-pill hidden lg:inline-flex"
            >
              大学模拟器
            </a>
          </div>
        </div>
      </header>

      <main
        className={`relative z-10 -mt-1 grid flex-1 gap-2.5 overflow-hidden p-2.5 pt-2 sm:gap-3 sm:p-3 sm:pt-2.5 ${
          shouldReserveSidePanel
            ? "grid-rows-[minmax(52vh,1fr)_minmax(200px,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] lg:grid-rows-1"
            : "grid-rows-1"
        }`}
      >
        <section aria-label="高校地图" className="paper-card home-map-card relative min-h-0 overflow-hidden rounded-lg before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-4 before:bg-gradient-to-b before:from-[rgba(247,241,228,0.28)] before:to-transparent">
          <ChinaMap3D
            schools={data.schools}
            highlightedSchools={filteredSchools}
            provinces={filteredProvinces}
            selectedProvince={selectedProvince}
            previewSchool={previewSchool}
            hasActiveMapFilters={activeFilterCount > 0 || query.trim().length > 0}
            filter985={filter985}
            filter211={filter211}
            filterDoubleFirst={filterDoubleFirst}
            onProvinceSelect={setProvince}
            onSchoolPreview={(s) => dispatch({ type: "SET_PREVIEW_SCHOOL", payload: s })}
            onSchoolClick={(s) => router.push(`/school/${encodeURIComponent(s.name)}`)}
            onToggle985={() => dispatch({ type: "TOGGLE_FILTER", payload: "985" })}
            onToggle211={() => dispatch({ type: "TOGGLE_FILTER", payload: "211" })}
            onToggleDoubleFirst={() =>
              dispatch({ type: "TOGGLE_FILTER", payload: "doubleFirst" })
            }
            onTransitionChange={handleMapTransitionChange}
          />
        </section>

        <AnimatePresence mode="wait">
          {hasSidePanelContent && (
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
                            {visibleProvince ?? "筛选结果"}
                          </div>
                        </div>
                        <PanelBlessing className="hidden max-w-[188px] sm:flex" />
                        {(visibleProvince || hasActiveSearch || activeFilterCount > 0) && (
                          <Button
                            theme="light"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              if (visibleProvince) {
                                setTransitionProvince(visibleProvince);
                                setProvince(null);
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
                      selectedProvince={visibleProvince}
                      selectedSchool={selectedSchool}
                      compareSchools={compareSchools}
                      onProvinceClick={setProvince}
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
