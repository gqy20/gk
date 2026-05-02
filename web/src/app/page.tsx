"use client";

import { useState, useMemo, useEffect } from "react";
import ChinaMap from "@/components/ChinaMap";
import FilterBar from "@/components/FilterBar";
import ProvinceList from "@/components/ProvinceList";
import SchoolPanel from "@/components/SchoolPanel";
import type { School, ProvinceData } from "@/lib/data";

export default function Home() {
  const [data, setData] = useState<{ schools: School[]; provinces: ProvinceData[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [filter985, setFilter985] = useState(false);
  const [filter211, setFilter211] = useState(false);
  const [filterDoubleFirst, setFilterDoubleFirst] = useState(false);

  // 加载数据
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

  // 筛选逻辑
  const filteredSchools = useMemo(() => {
    if (!data) return [];
    let result = data.schools;
    if (filter985) result = result.filter((s) => s.is985);
    if (filter211) result = result.filter((s) => s.is211);
    if (filterDoubleFirst) result = result.filter((s) => s.isDoubleFirstClass);
    return result;
  }, [data, filter985, filter211, filterDoubleFirst]);

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

  const handleProvinceSelect = (province: string | null) => {
    setSelectedProvince(province === selectedProvince ? null : province);
    setSelectedSchool(null);
  };

  const handleSchoolClick = (school: School) => {
    setSelectedSchool(school);
    setSelectedProvince(school.province);
  };

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400">
        加载中...
      </div>
    );
  }

  return (
    <div className="h-screen min-h-screen flex flex-col bg-gray-50">
      {/* 顶部标题 + 筛选 */}
      <header className="bg-white shadow-sm z-10">
        <div className="px-4 py-2">
          <h1 className="text-lg font-bold text-gray-800">
            中国高校信息地图
            <span className="ml-2 text-xs font-normal text-gray-400">
              {data.schools.length} 所高校 · {selectedSchool ? selectedSchool.name : "点击查看详情"}
            </span>
          </h1>
        </div>
        <FilterBar
          filter985={filter985}
          filter211={filter211}
          filterDoubleFirst={filterDoubleFirst}
          totalCount={data.schools.length}
          filteredCount={filteredSchools.length}
          onToggle985={() => setFilter985((v) => !v)}
          onToggle211={() => setFilter211((v) => !v)}
          onToggleDoubleFirst={() => setFilterDoubleFirst((v) => !v)}
        />
      </header>

      {/* 主内容区：左地图 + 右侧面板 */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* 左侧：地图 */}
        <div className="min-h-[45vh] lg:min-h-0 lg:flex-[3] relative border-b lg:border-b-0 lg:border-r border-gray-200">
          <ChinaMap
            schools={filteredSchools}
            provinces={filteredProvinces}
            selectedProvince={selectedProvince}
            onProvinceSelect={handleProvinceSelect}
            onSchoolClick={handleSchoolClick}
          />
        </div>

        {/* 右侧：省份列表 + 学校详情 */}
        <aside className="flex-1 min-h-0 lg:flex-[2] flex flex-col bg-white lg:min-w-[320px] lg:max-w-[430px]">
          {selectedSchool ? (
            <SchoolPanel
              key={selectedSchool.name}
              school={selectedSchool}
              onClose={() => setSelectedSchool(null)}
            />
          ) : (
            <>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-500">
                  省份列表
                  {selectedProvince && ` (${selectedProvince})`}
                </span>
                {selectedProvince && (
                  <button
                    onClick={() => handleProvinceSelect(null)}
                    className="ml-2 text-[10px] text-blue-500 hover:underline"
                  >
                    返回全部
                  </button>
                )}
                {loadError && (
                  <span className="ml-2 text-[10px] text-orange-500">
                    数据加载失败：{loadError}
                  </span>
                )}
              </div>
              <ProvinceList
                provinces={filteredProvinces}
                selectedProvince={selectedProvince}
                selectedSchool={selectedSchool}
                onProvinceClick={handleProvinceSelect}
                onSchoolClick={handleSchoolClick}
              />
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
