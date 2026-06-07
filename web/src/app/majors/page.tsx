"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import MajorCategoryNav from "@/components/majors/MajorCategoryNav";
import MajorTreeBrowser from "@/components/majors/MajorTreeBrowser";
import MajorList from "@/components/majors/MajorList";
import MajorSearchBar from "@/components/majors/MajorSearchBar";
import type { MajorsData, MajorCategory } from "@/types/majors";
import { EMPTY_MESSAGES } from "@/lib/constants";

export default function MajorsPage() {
  const [data, setData] = useState<MajorsData | null>(null);
  const [activeCatKey, setActiveCatKey] = useState<string>("");
  const [selectedMenlei, setSelectedMenlei] = useState<string | null>(null);
  const [selectedClassKey, setSelectedClassKey] = useState<string | null>(null);
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
    setSelectedClassKey(null); // 切换门类时清空专业类选择
    if (key !== null) setSearchQuery("");
  }, []);

  const handleSelectClass = useCallback(
    (classKey: string | null, parentMenleiKey: string) => {
      setSelectedMenlei(parentMenleiKey);
      setSelectedClassKey(classKey);
      if (classKey !== null) setSearchQuery("");
    },
    [],
  );

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-surface text-text">
      {/* Header */}
      <header className="relative z-10 shrink-0 border-b border-border bg-surface-elevated/95 px-3 py-2 shadow-sm shadow-neutral-900/5 sm:px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-text-secondary hover:text-text transition-colors"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="min-w-0 truncate text-base font-semibold text-text sm:text-xl">
            专业库
          </h1>
          {data && (
            <span className="hidden text-xs text-text-muted sm:inline">
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
            setSelectedClassKey(null);
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
            className="hidden w-52 shrink-0 overflow-y-auto border-r border-border bg-surface-subtle sm:block"
          >
            <MajorTreeBrowser
              category={activeCategory}
              selectedMenlei={selectedMenlei}
              selectedClassKey={selectedClassKey}
              onSelectMenlei={handleSelectMenlei}
              onSelectClass={handleSelectClass}
            />
          </aside>
        )}

        {/* 右侧：专业列表（桌面 & 移动端共用） */}
        <section aria-label="专业列表" className="min-w-0 flex-1 flex flex-col overflow-hidden">
          {/* 移动端：门类选择条 */}
          {activeCategory && (
            <div className="shrink-0 border-b border-border px-3 py-2 sm:hidden">
              <select
                value={selectedClassKey || selectedMenlei || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    handleSelectMenlei(null);
                    return;
                  }
                  // 判断是专业类 key（长度 > 4，如 "10500203"）还是门类 key
                  const matchedClass = activeCategory.门类
                    .flatMap((m) => m.专业类.map((c) => ({ ...c, menleiKey: m.key })))
                    .find((c) => c.key === val);
                  if (matchedClass) {
                    handleSelectClass(matchedClass.key, matchedClass.menleiKey);
                  } else {
                    // 门级选择
                    handleSelectMenlei(val);
                  }
                }}
                className="w-full rounded-lg border border-border bg-surface-subtle px-3 py-1.5 text-xs text-text outline-none focus:border-primary/50"
              >
                <option value="">全部门类</option>
                {activeCategory.门类.map((m) => (
                  <optgroup key={m.key} label={`${m.name} (${m.major_count})`}>
                    {m.专业类.map((cls) => (
                      <option key={cls.key} value={cls.key}>
                        {cls.name} ({cls.专业.length})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          <div className="min-w-0 flex-1 overflow-hidden">
            {activeCategory ? (
              <MajorList
                category={activeCategory}
                menleiKey={selectedMenlei}
                classKey={selectedClassKey}
                searchQuery={searchQuery}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-text-muted">
                {EMPTY_MESSAGES.loadingMap}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
