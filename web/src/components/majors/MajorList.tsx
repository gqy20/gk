"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import type { MajorCategory } from "@/types/majors";

interface MajorListProps {
  category: MajorCategory;
  menleiKey: string | null;
  searchQuery: string;
}

function satisfactionColor(score: string): string {
  const num = parseFloat(score);
  if (isNaN(num) || num === 0) return "text-dark-500";
  if (num >= 4.0) return "text-green-300";
  if (num >= 3.5) return "text-gold-300";
  return "text-dark-200";
}

function filterMajors(category: MajorCategory, menleiKey: string | null, query: string) {
  const q = query.trim().toLowerCase();
  const results: { menleiName: string; major: typeof category["门类"][0]["专业类"][0]["专业"][0] }[] = [];

  for (const menlei of category.门类) {
    // 如果选了门类，只展示该门类
    if (menleiKey && menlei.key !== menleiKey) continue;

    for (const cls of menlei.专业类) {
      for (const major of cls.专业) {
        // 搜索过滤
        if (q) {
          const matchName = (major.zymc || "").toLowerCase().includes(q);
          const matchCode = major.zydm.includes(q);
          const matchClassName = (cls.name || "").toLowerCase().includes(q);
          const matchMenleiName = (menlei.name || "").toLowerCase().includes(q);
          if (!(matchName || matchCode || matchClassName || matchMenleiName)) continue;
        }
        results.push({ menleiName: menlei.name, major });
      }
    }
  }
  return results;
}

export default function MajorList({ category, menleiKey, searchQuery }: MajorListProps) {
  const items = filterMajors(category, menleiKey, searchQuery);

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-dark-500">
        {searchQuery ? `未找到匹配「${searchQuery}」的专业` : "请选择左侧门类或搜索专业"}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2.5 sm:p-3">
      <div className="mb-2 px-1 text-[11px] text-dark-500">
        共 {items.length} 个专业
      </div>
      <div className="space-y-1.5">
        {items.map(({ menleiName, major }, i) => (
          <motion.a
            key={major.specId}
            href={major.detail_url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.015, 0.3), duration: 0.2 }}
            className="flex items-center gap-2 sm:gap-3 rounded-lg border border-border bg-surface-elevated/60 px-2.5 py-2 sm:px-3 sm:py-2.5 transition-colors hover:border-primary/30 hover:bg-surface-active active:bg-surface-active"
          >
            {/* 专业代码（桌面端显示） */}
            <span className="hidden shrink-0 font-mono text-[10px] text-dark-500 tabular-nums sm:inline">
              {major.zydm}
            </span>

            {/* 名称 + 门类 */}
            <div className="min-w-0 flex-1 min-h-0">
              <div className="truncate text-xs font-medium leading-tight text-text">
                {major.zymc !== "-" ? major.zymc : `专业 ${major.zydm}`}
              </div>
              <div className="truncate text-[10px] text-dark-500">{menleiName}</div>
            </div>

            {/* 满意度 */}
            <span className={`shrink-0 text-xs font-semibold tabular-nums ${satisfactionColor(major.list_satisfaction)}`}>
              {major.list_satisfaction !== "-" && major.list_satisfaction !== "0.0"
                ? major.list_satisfaction
                : "-"}
            </span>

            {/* 标签 */}
            <div className="flex shrink-0 gap-1">
              {major.has_interpretation && (
                <Badge label="解读" tone="green" size="sm" variant="subtle" />
              )}
              {major.graduate_scale !== "-" && (
                <Badge label={major.graduate_scale} tone="gold" size="compact" variant="outline" className="hidden xs:inline-flex" />
              )}
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
