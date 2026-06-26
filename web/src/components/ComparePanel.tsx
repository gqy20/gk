"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconClose } from "@/components/ui/Icon";
import type { School, DetailCategoryKey } from "@/lib/data";
import { STAT_LABELS } from "@/lib/constants";
import { CATEGORY_LABELS, DETAIL_CATEGORIES } from "@/lib/data";

interface ComparePanelProps {
  schools: School[];
  onClose: () => void;
  onRemove: (school: School) => void;
}

const ALL_CATEGORIES: DetailCategoryKey[] = [
  ...DETAIL_CATEGORIES,
  "colleges",
  "student_experiences",
];

function getCategoryCount(school: School, key: DetailCategoryKey): number {
  if (!school.detail) return 0;
  const items = school.detail[key];
  return Array.isArray(items) ? items.length : 0;
}

export default function ComparePanel({ schools, onClose, onRemove }: ComparePanelProps) {
  // 预计算每个数值维度在所有学校中的最大值，用于「最优」高亮
  const maxCounts = useMemo(() => {
    const m: Record<string, number> = {};
    m.colleges = Math.max(0, ...schools.map((s) => s.detail?.colleges?.length ?? 0));
    for (const key of ALL_CATEGORIES) {
      m[key] = Math.max(0, ...schools.map((s) => getCategoryCount(s, key)));
    }
    return m;
  }, [schools]);

  const showScrollHint = schools.length > 2;

  return (
    <div className="paper-shell flex h-full flex-col text-text-light">
      <div className="border-b border-border-light bg-accent-50/45 px-4 py-4 text-text">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold leading-tight">
              学校对比
            </h2>
            <div className="mt-1 text-xs text-text-secondary">
              {schools.length} 所学校 · 同一行数值最高者高亮
            </div>
          </div>
          {onClose && (
            <Button theme="dark" variant="secondary" size="sm" onClick={onClose}>
              返回列表
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {showScrollHint && (
          <p className="mb-2 text-center text-[11px] text-text-muted">
            ← 左右滑动查看更多学校 →
          </p>
        )}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {schools.map((school, index) => {
            const collegeCount = school.detail?.colleges?.length ?? 0;
            return (
              <div
                key={`${school.name || school.url || "school"}-${index}`}
                className="flex w-[200px] shrink-0 flex-col rounded-md border border-border-light bg-neutral-0/74 shadow-sm shadow-neutral-900/5"
              >
                <div className="border-b border-border-light bg-accent-50/45 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-tight text-text-light">
                      {school.name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onRemove(school)}
                      className="shrink-0 rounded-full p-1 text-danger-400 transition hover:bg-danger-soft"
                      title="移除"
                    >
                      <IconClose size={14} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {school.is985 && <Badge label="985" tone="red" size="sm" />}
                    {school.is211 && <Badge label="211" tone="gold" size="sm" />}
                    {school.isDoubleFirstClass && <Badge label="双一流" tone="green" size="sm" />}
                  </div>
                </div>

                <div className="flex-1 px-3 py-3">
                  <div className="space-y-2.5 text-xs">
                    <CompareRow label="省份" value={school.province} />
                    <CompareRow
                      label={STAT_LABELS.college}
                      value={`${collegeCount} ${STAT_LABELS.unit}`}
                      isBest={collegeCount > 0 && collegeCount === maxCounts.colleges}
                    />

                    <div className="h-px bg-border-light" />

                    {ALL_CATEGORIES.map((key) => {
                      const count = getCategoryCount(school, key);
                      return (
                        <CompareRow
                          key={key}
                          label={CATEGORY_LABELS[key]}
                          value={`${count} 条`}
                          isBest={count > 0 && count === maxCounts[key]}
                        />
                      );
                    })}

                  </div>
                </div>

                <div className="border-t border-border-light px-3 py-2">
                  <a
                    href={school.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-brand-500 hover:text-brand-400"
                  >
                    {school.url.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompareRow({
  label,
  value,
  isBest,
}: {
  label: string;
  value: string;
  /** 该维度在本次对比中数值最高 → 加粗高亮 */
  isBest?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-text-light-muted">{label}</span>
      <span className={`tabular-nums ${isBest ? "font-semibold text-brand-500" : "font-medium text-text-light"}`}>
        {value}
      </span>
    </div>
  );
}
