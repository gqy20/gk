"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconClose } from "@/components/ui/Icon";
import type { School, DetailCategoryKey } from "@/lib/data";
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
  return (
    <div className="flex h-full flex-col bg-surface-light text-text-light">
      <div className="border-b border-border-light bg-base-950 px-4 py-4 text-text">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              School Detail
            </div>
            <h2 className="mt-2 text-xl font-semibold leading-tight">
              学校对比
            </h2>
            <div className="mt-1 text-xs text-dark-300">
              {schools.length} 所学校
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
        <div className="flex gap-3 overflow-x-auto pb-2">
          {schools.map((school) => (
            <div
              key={school.name}
              className="flex w-[200px] shrink-0 flex-col rounded-lg border border-border-light bg-ink-50 shadow-sm"
            >
              <div className="border-b border-border-light bg-ink-200 px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-tight text-text-light">
                    {school.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => onRemove(school)}
                    className="shrink-0 rounded-full p-1 text-red-400 transition hover:bg-red-50"
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
                  <CompareRow label="状态" value={school.status === "done" ? "已采集" : "待采集"} />
                  <CompareRow
                    label="学院"
                    value={`${school.detail?.colleges?.length ?? 0} 个`}
                  />

                  <div className="h-px bg-border-light" />

                  {ALL_CATEGORIES.map((key) => {
                    const count = getCategoryCount(school, key);
                    return (
                      <CompareRow
                        key={key}
                        label={CATEGORY_LABELS[key]}
                        value={`${count} 条`}
                        highlight={count > 0}
                      />
                    );
                  })}

                  {school.detail?.crawl_time && (
                    <>
                      <div className="h-px bg-border-light" />
                      <CompareRow
                        label="抓取时间"
                        value={school.detail.crawl_time.slice(0, 16)}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-border-light px-3 py-2">
                <a
                  href={school.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-green-800 hover:text-green-700"
                >
                  {school.url.replace(/^https?:\/\//, "")}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompareRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-dark-600">{label}</span>
      <span className={`font-medium ${highlight ? "text-green-400" : "text-dark-950"}`}>
        {value}
      </span>
    </div>
  );
}
