"use client";

import { useState, useEffect, useCallback } from "react";
import MajorCategoryNav from "@/components/majors/MajorCategoryNav";
import MajorTreeBrowser from "@/components/majors/MajorTreeBrowser";
import MajorList from "@/components/majors/MajorList";
import MajorSearchBar from "@/components/majors/MajorSearchBar";
import type { MajorsData, MajorCategory } from "@/types/majors";

export default function MajorsPage() {
  const [data, setData] = useState<MajorsData | null>(null);
  const [activeCatKey, setActiveCatKey] = useState<string>("");
  const [selectedMenlei, setSelectedMenlei] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/data/majors_data.json")
      .then((r) => r.json())
      .then((json: MajorsData) => {
        setData(json);
        setActiveCatKey(json.categories[0]?.key || "");
      })
      .catch(() => {});
  }, []);

  const activeCategory: MajorCategory | undefined = data?.categories.find(
    (c) => c.key === activeCatKey,
  );

  const handleSelectMenlei = useCallback((key: string | null) => {
    setSelectedMenlei(key);
    if (key !== null) setSearchQuery("");
  }, []);

  // 当前选中的门类名称（用于移动端 selector 显示）
  const selectedMenleiName =
    activeCategory && selectedMenlei
      ? activeCategory.门类.find((m) => m.key === selectedMenlei)?.name
      : "全部门类";

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-surface text-text">
      {/* Header */}
      <header className="relative z-10 shrink-0 border-b border-border bg-surface/95 px-3 py-2 shadow-2xl shadow-black/20 sm:px-4">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2 text-dark-300 hover:text-text transition-colors"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </a>
          <h1 className="min-w-0 truncate text-base font-semibold text-dark-50 sm:text-xl">
            专业库
          </h1>
          {data && (
            <span className="hidden text-xs text-dark-500 sm:inline">
              共 {data.categories.reduce((sum, c) => sum + c.门类.reduce((s, m) => s + m.major_count, 0), 0)} 个专业
            </span>
          )}
        </div>
      </header>

      {/* 分类导航 */}
      {data && (
        <MajorCategoryNav
          categories={data.categories}
          activeKey={activeCatKey}
          onSelect={(key) => {
            setActiveCatKey(key);
            setSelectedMenlei(null);
            setSearchQuery("");
          }}
        />
      )}

      {/* 搜索栏 */}
      <div className="shrink-0">
        <MajorSearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* 主内容区 */}
      <main className="relative z-10 flex flex-1 min-h-0 overflow-hidden">
        {/* 桌面端：左侧树 */}
        {activeCategory && (
          <aside
            aria-label="专业分类"
            className="hidden w-52 shrink-0 overflow-y-auto border-r border-border bg-surface-elevated/40 sm:block"
          >
            <MajorTreeBrowser
              category={activeCategory}
              selectedMenlei={selectedMenlei}
              onSelectMenlei={handleSelectMenlei}
            />
          </aside>
        )}

        {/* 右侧：专业列表（桌面 & 移动端共用） */}
        <section aria-label="专业列表" className="min-w-0 flex-1 flex flex-col overflow-hidden">
          {/* 移动端：门类选择条 */}
          {activeCategory && (
            <div className="shrink-0 border-b border-border px-3 py-2 sm:hidden">
              <select
                value={selectedMenlei || ""}
                onChange={(e) => handleSelectMenlei(e.target.value || null)}
                className="w-full rounded-lg border border-border bg-surface-active px-3 py-1.5 text-xs text-text outline-none focus:border-primary/50"
              >
                <option value="">全部门类</option>
                {activeCategory.门类.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name} ({m.major_count})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="min-w-0 flex-1 overflow-hidden">
            {activeCategory ? (
              <MajorList
                category={activeCategory}
                menleiKey={selectedMenlei}
                searchQuery={searchQuery}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-dark-500">
                加载中...
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
