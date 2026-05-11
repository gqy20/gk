"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MajorCategory } from "@/types/majors";

interface MajorTreeBrowserProps {
  category: MajorCategory;
  selectedMenlei: string | null;
  onSelectMenlei: (key: string | null) => void;
}

export default function MajorTreeBrowser({
  category,
  selectedMenlei,
  onSelectMenlei,
}: MajorTreeBrowserProps) {
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  // 自动展开选中的门类
  const memoExpanded = useMemo(() => {
    const next = new Set(expandedClasses);
    if (selectedMenlei && !next.has(selectedMenlei)) {
      next.add(selectedMenlei);
    }
    return next;
  }, [expandedClasses, selectedMenlei]);

  function toggleClass(key: string) {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // 统计当前分类的总数
  const totalMajors = category.门类.reduce((s, m) => s + m.major_count, 0);

  return (
    <div className="flex flex-col h-full">
      {/* 全部门类入口 */}
      <button
        type="button"
        onClick={() => onSelectMenlei(null)}
        className={cn(
          "flex items-center justify-between rounded-lg px-3 py-2.5 mb-1 text-xs font-medium transition-colors mx-2 mt-2",
          !selectedMenlei
            ? "bg-primary/15 text-primary"
            : "text-dark-300 hover:bg-surface-active hover:text-text",
        )}
      >
        <span className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          全部门类
        </span>
        <span className="rounded-full bg-surface-active px-2 py-0.5 text-[10px] tabular-nums">
          {totalMajors}
        </span>
      </button>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {category.门类.map((menlei) => {
          const isSelected = selectedMenlei === menlei.key;
          const isExpanded = memoExpanded.has(menlei.key);

          return (
            <div key={menlei.key} className="mb-0.5">
              {/* 门类按钮 */}
              <button
                type="button"
                onClick={() => {
                  const next = isSelected ? null : menlei.key;
                  onSelectMenlei(next);
                  if (!isExpanded) toggleClass(menlei.key);
                }}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-all duration-150",
                  isSelected
                    ? "bg-primary/12 text-primary shadow-sm shadow-primary/5"
                    : "text-dark-200 hover:bg-surface-active hover:text-text",
                )}
              >
                {/* 展开/收起箭头 */}
                <svg
                  className={cn(
                    "h-3 w-3 shrink-0 text-dark-500 transition-transform duration-200",
                    isExpanded && "rotate-90",
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                <span className="flex-1 truncate">{menlei.name}</span>

                {/* 数量标签 */}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums transition-colors",
                    isSelected
                      ? "bg-primary/20 text-primary"
                      : "bg-surface-active text-dark-500 group-hover:text-dark-300",
                  )}
                >
                  {menlei.major_count}
                </span>
              </button>

              {/* 展开的专业类列表 */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    {menlei.专业类.map((cls) => {
                      const hasSelectedClass = isSelected; // 该门类下所有子项都视为激活上下文
                      return (
                        <button
                          key={cls.key}
                          type="button"
                          onClick={() => onSelectMenlei(menlei.key)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 truncate border-l-2 pl-6 pr-3 py-1.5 text-[11px] transition-colors",
                            hasSelectedClass
                              ? "border-primary/40 text-dark-200 hover:text-text"
                              : "border-border-subtle text-dark-500 hover:text-dark-300 hover:border-border",
                          )}
                        >
                          <span className="truncate">{cls.name}</span>
                          <span className="shrink-0 text-[10px] text-dark-600 tabular-nums">
                            {cls.专业.length}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
