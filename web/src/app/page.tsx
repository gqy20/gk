"use client";

import { useState, useMemo, useEffect } from "react";
import ChinaMap from "@/components/ChinaMap";
import CompareBar from "@/components/CompareBar";
import ComparePanel from "@/components/ComparePanel";
import FilterBar from "@/components/FilterBar";
import ProvinceList from "@/components/ProvinceList";
import SchoolPanel from "@/components/SchoolPanel";
import type { School, ProvinceData } from "@/lib/data";

export default function Home() {
  const [data, setData] = useState<{ schools: School[]; provinces: ProvinceData[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [query, setQuery] = useState("");
  const [filter985, setFilter985] = useState(false);
  const [filter211, setFilter211] = useState(false);
  const [filterDoubleFirst, setFilterDoubleFirst] = useState(false);
  const [compareSchools, setCompareSchools] = useState<School[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/data/schools.json");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          schools: School[];
          provinces: ProvinceData[];
        };
        setData(json);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "未知错误");
        setData({ schools: [], provinces: [] });
      }
    }
    load();
  }, []);

  const filteredSchools = useMemo(() => {
    if (!data) return [];
    let result = data.schools;
    const keyword = query.trim().toLowerCase();
    if (keyword) {
      result = result.filter((school) => {
        const haystack = `${school.name} ${school.province} ${school.url}`.toLowerCase();
        return haystack.includes(keyword);
      });
    }
    if (filter985) result = result.filter((s) => s.is985);
    if (filter211) result = result.filter((s) => s.is211);
    if (filterDoubleFirst) result = result.filter((s) => s.isDoubleFirstClass);
    return result;
  }, [data, query, filter985, filter211, filterDoubleFirst]);

  const filteredProvinces = useMemo(() => {
    const provMap = new Map<string, School[]>();
    for (const s of filteredSchools) {
      const list = provMap.get(s.province) || [];
      list.push(s);
      provMap.set(s.province, list);
    }
    return Array.from(provMap.entries())
      .map(([name, schools]) => ({ name, count: schools.length, schools }))
      .sort((a, b) => b.count - a.count);
  }, [filteredSchools]);

  const doneCount = useMemo(
    () => data?.schools.filter((school) => school.status === "done").length ?? 0,
    [data],
  );

  const filteredDoneCount = useMemo(
    () => filteredSchools.filter((school) => school.status === "done").length,
    [filteredSchools],
  );

  const activeFilterCount = [filter985, filter211, filterDoubleFirst].filter(Boolean).length;

  const handleProvinceSelect = (province: string | null) => {
    setSelectedProvince(province === selectedProvince ? null : province);
    setSelectedSchool(null);
    setCompareOpen(false);
  };

  const handleSchoolClick = (school: School) => {
    setSelectedSchool(school);
    setSelectedProvince(school.province);
    setCompareOpen(false);
  };

  const handleResetFilters = () => {
    setQuery("");
    setFilter985(false);
    setFilter211(false);
    setFilterDoubleFirst(false);
  };

  const handleCompareToggle = (school: School) => {
    setCompareSchools((prev) => {
      const exists = prev.find((s) => s.name === school.name);
      if (exists) {
        return prev.filter((s) => s.name !== school.name);
      }
      if (prev.length >= 3) return prev;
      return [...prev, school];
    });
  };

  const handleCompareRemove = (school: School) => {
    setCompareSchools((prev) => prev.filter((s) => s.name !== school.name));
  };

  const handleCompareClear = () => {
    setCompareSchools([]);
    setCompareOpen(false);
  };

  useEffect(() => {
    if (compareSchools.length < 2 && compareOpen) {
      setCompareOpen(false);
    }
  }, [compareSchools.length, compareOpen]);

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#10120f] text-sm text-[#d8caa6]">
        <span className="mr-3 h-2 w-2 rounded-full bg-[#d8b75d]" />
        地图数据加载中
      </div>
    );
  }

  const contextLabel = selectedSchool
    ? selectedSchool.name
    : selectedProvince
      ? `${selectedProvince} · ${filteredSchools.filter((school) => school.province === selectedProvince).length} 所`
      : "全国高校";

  return (
    <div className="relative flex h-screen min-h-screen flex-col overflow-hidden bg-[#10120f] text-[#f7f1e4]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:44px_44px]"
      />

      <header className="relative z-10 border-b border-white/10 bg-[#10120f]/95 px-3 py-3 shadow-2xl shadow-black/20 sm:px-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d8b75d]">
              Gaokao Research Atlas
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <img
                src="/logo.svg"
                alt=""
                className="h-8 w-8 rounded-lg"
                width={32}
                height={32}
              />
              <h1 className="text-2xl font-semibold leading-none text-[#fff9ec] sm:text-3xl">
                中国高校信息地图
              </h1>
              <span className="max-w-full truncate text-xs text-[#bdb5a4] sm:text-sm">
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
          onQueryChange={setQuery}
          onToggle985={() => setFilter985((v) => !v)}
          onToggle211={() => setFilter211((v) => !v)}
          onToggleDoubleFirst={() => setFilterDoubleFirst((v) => !v)}
          onReset={handleResetFilters}
        />
      </header>

      <main className="relative z-10 grid flex-1 grid-rows-[minmax(0,1fr)_minmax(260px,40vh)] gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] lg:grid-rows-1">
        <section className="relative min-h-0 overflow-hidden rounded-lg border border-white/10 bg-[#171c18]/92 shadow-2xl shadow-black/25">
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#d8caa6]">
            <span className="rounded-full border border-[#d8b75d]/45 bg-[#10120f]/80 px-3 py-1">
              Interactive Map
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1">
              {filteredSchools.length} Pins
            </span>
          </div>
          <ChinaMap
            schools={filteredSchools}
            provinces={filteredProvinces}
            selectedProvince={selectedProvince}
            onProvinceSelect={handleProvinceSelect}
            onSchoolClick={handleSchoolClick}
          />
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#f5f0e6] text-[#181713] shadow-2xl shadow-black/25">
          {compareOpen ? (
            <ComparePanel
              schools={compareSchools}
              onClose={() => setCompareOpen(false)}
              onRemove={handleCompareRemove}
            />
          ) : selectedSchool ? (
            <SchoolPanel
              key={selectedSchool.name}
              school={selectedSchool}
              onClose={() => setSelectedSchool(null)}
            />
          ) : (
            <>
              <div className="border-b border-black/10 bg-[#f9f5ec] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a57d22]">
                      Province Index
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#181713]">
                      {selectedProvince || "全部省份"}
                    </div>
                  </div>
                  {selectedProvince && (
                    <button
                      onClick={() => handleProvinceSelect(null)}
                      className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-[#2c5f55] transition hover:border-[#2c5f55]/50 hover:bg-[#dfeee8]"
                    >
                      返回全部
                    </button>
                  )}
                </div>
                {loadError && (
                  <div className="mt-2 rounded border border-[#d8872f]/30 bg-[#fff3df] px-2 py-1 text-[11px] text-[#9a5a13]">
                    数据加载失败：{loadError}
                  </div>
                )}
              </div>
              <ProvinceList
                provinces={filteredProvinces}
                selectedProvince={selectedProvince}
                selectedSchool={selectedSchool}
                compareSchools={compareSchools}
                onProvinceClick={handleProvinceSelect}
                onSchoolClick={handleSchoolClick}
                onCompareToggle={handleCompareToggle}
              />
              <CompareBar
                schools={compareSchools}
                onRemove={handleCompareRemove}
                onCompare={() => setCompareOpen(true)}
                onClear={handleCompareClear}
              />
            </>
          )}
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
      ? "text-[#f1c15f]"
      : tone === "green"
        ? "text-[#80c9b4]"
        : "text-[#fff9ec]";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#9f9888]">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold leading-none ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
