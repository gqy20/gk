"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MajorCategory } from "@/types/majors";

interface MajorListProps {
  category: MajorCategory;
  menleiKey: string | null;
  searchQuery: string;
}

/** 从专业类名推断可读名称（zymc 为 "-" 时使用） */
function resolveMajorName(major: { zymc: string; zydm: string }, className: string): string {
  if (major.zymc && major.zymc !== "-") return major.zymc;
  // 用专业类名去掉"类"字作为 fallback
  const clean = className.replace(/类$/, "");
  return clean || `专业 ${major.zydm}`;
}

/** 满意度配置 */
function satisfactionConfig(score: string) {
  const num = parseFloat(score);
  if (isNaN(num) || num === 0) {
    return {
      color: "bg-dark-700",
      textColor: "text-dark-600",
      label: "暂无",
      pct: 0,
    };
  }
  if (num >= 4.5) return { color: "bg-green-300", textColor: "text-green-300", label: score, pct: (num / 5) * 100 };
  if (num >= 4.0) return { color: "bg-green-400", textColor: "text-green-400", label: score, pct: (num / 5) * 100 };
  if (num >= 3.5) return { color: "bg-gold-300", textColor: "text-gold-300", label: score, pct: (num / 5) * 100 };
  if (num >= 3.0) return { color: "bg-dark-300", textColor: "text-dark-200", label: score, pct: (num / 5) * 100 };
  return { color: "bg-dark-500", textColor: "text-dark-500", label: score, pct: (num / 5) * 100 };
}

function filterMajors(category: MajorCategory, menleiKey: string | null, query: string) {
  const q = query.trim().toLowerCase();
  const results: {
    menleiName: string;
    className: string;
    major: typeof category["门类"][0]["专业类"][0]["专业"][0];
  }[] = [];

  for (const menlei of category.门类) {
    if (menleiKey && menlei.key !== menleiKey) continue;

    for (const cls of menlei.专业类) {
      for (const major of cls.专业) {
        if (q) {
          const matchName = (major.zymc || "").toLowerCase().includes(q);
          const matchCode = major.zydm.includes(q);
          const matchClassName = (cls.name || "").toLowerCase().includes(q);
          const matchMenleiName = (menlei.name || "").toLowerCase().includes(q);
          if (!(matchName || matchCode || matchClassName || matchMenleiName)) continue;
        }
        results.push({ menleiName: menlei.name, className: cls.name, major });
      }
    }
  }
  return results;
}

/** 空状态引导组件 */
function EmptyGuide({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="rounded-2xl border border-border-subtle bg-surface-elevated/40 p-6">
        <svg className="mx-auto h-10 w-10 text-dark-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-dark-200">
          {hasSearch ? `未找到匹配结果` : "选择左侧门类开始浏览"}
        </p>
        <p className="mt-1 text-xs text-dark-500">
          {hasSearch
            ? "尝试其他关键词或清空搜索"
            : "共 " + (hasSearch ? "" : "") + " 个专业分布在 13 个门类中"}
        </p>
      </div>
    </div>
  );
}

export default function MajorList({ category, menleiKey, searchQuery }: MajorListProps) {
  const items = useMemo(
    () => filterMajors(category, menleiKey, searchQuery),
    [category, menleiKey, searchQuery],
  );

  // 当前选中的门类信息
  const activeMenlei = menleiKey
    ? category.门类.find((m) => m.key === menleiKey)
    : null;

  // 无选中门类且无搜索时 → 显示引导（不倾倒全量列表）
  if (items.length === 0 || (!menleiKey && !searchQuery.trim())) {
    return <EmptyGuide hasSearch={!!searchQuery.trim()} />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 统计条 */}
      <header className="shrink-0 border-b border-border px-4 py-2.5 bg-surface-elevated/30">
        <div className="flex items-center gap-2">
          {activeMenlei ? (
            <>
              <span className="inline-flex items-center rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {activeMenlei.name}
              </span>
              <span className="text-[11px] text-dark-500">
                共 <span className="font-semibold tabular-nums text-dark-300">{items.length}</span> 个专业
              </span>
              {searchQuery.trim() && (
                <span className="rounded-full bg-surface-active px-2 py-0.5 text-[10px] text-dark-400">
                  搜索: {searchQuery}
                </span>
              )}
            </>
          ) : searchQuery.trim() ? (
            <span className="text-[11px] text-dark-500">
              搜索「<span className="text-dark-300">{searchQuery}</span>」:
              <span className="font-semibold tabular-nums text-dark-300"> {items.length}</span> 个结果
            </span>
          ) : (
            <span className="text-[11px] text-dark-500">
              全部门类 · <span className="font-semibold tabular-nums text-dark-300">{items.length}</span> 个专业
            </span>
          )}
        </div>
      </header>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-3">
        <div className="space-y-1">
          {items.map(({ menleiName, className, major }, i) => {
            const name = resolveMajorName(major, className);
            const sat = satisfactionConfig(major.list_satisfaction);

            return (
              <motion.a
                key={major.specId}
                href={major.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.3), duration: 0.2 }}
                className="group grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-0.5 rounded-lg border border-border bg-surface-elevated/50 px-3 py-2.5 transition-colors hover:border-primary/25 hover:bg-surface-active active:bg-surface-active sm:grid-cols-[auto_1fr_auto_auto]"
              >
                {/* 第一行：代码 + 名称 + 满意度 + 标签 */}
                <span className="row-span-2 self-center hidden font-mono text-[10px] text-dark-600 tabular-nums sm:block">
                  {major.zydm}
                </span>

                {/* 名称 */}
                <div className="min-w-0 self-end">
                  <span className="truncate block text-xs font-medium leading-snug text-text group-hover:text-primary transition-colors">
                    {name}
                  </span>
                </div>

                {/* 满意度区域 */}
                <div className="col-span-1 self-center flex items-center gap-1.5 sm:col-span-1">
                  {parseFloat(major.list_satisfaction) > 0 ? (
                    <>
                      <span className={cn("text-xs font-bold tabular-nums tracking-wide", sat.textColor)}>
                        {sat.label}
                      </span>
                      {/* 进度条 */}
                      <div className="hidden w-12 h-1 rounded-full bg-surface-active overflow-hidden sm:block">
                        <motion.div
                          className={cn("h-full rounded-full", sat.color)}
                          initial={{ width: 0 }}
                          animate={{ width: `${sat.pct}%` }}
                          transition={{ delay: Math.min(i * 0.02 + 0.1, 0.4), duration: 0.35, ease: "easeOut" }}
                        />
                      </div>
                    </>
                  ) : (
                    <span className="text-[10px] text-dark-600">--</span>
                  )}
                </div>

                {/* 标签行 */}
                <div className="self-center flex items-center gap-1 justify-end">
                  {major.has_interpretation && (
                    <span className="inline-flex items-center rounded-md bg-green-500/12 px-1.5 py-px text-[10px] font-medium text-green-400">
                      解读
                    </span>
                  )}
                  {major.graduate_scale !== "-" && (
                    <span className="hidden items-center rounded-md bg-gold-500/10 px-1.5 py-px text-[10px] font-medium text-gold-400 xs:inline-flex">
                      {major.graduate_scale}
                    </span>
                  )}
                </div>

                {/* 第二行：专业类归属 */}
                <div className="col-start-2 min-w-0 self-start">
                  <span className="truncate text-[10px] text-dark-500">
                    {className}
                    {menleiName !== activeMenlei?.name && ` · ${menleiName}`}
                  </span>
                </div>
              </motion.a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
