"use client";

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

function Tag({ label, tone }: { label: string; tone: "red" | "gold" | "green" }) {
  const toneClass = {
    red: "border-[#e3a08b]/55 bg-[#f9ddd4] text-[#9d3b25]",
    gold: "border-[#d8b75d]/55 bg-[#f5e4bb] text-[#8a6414]",
    green: "border-[#6fc0a5]/55 bg-[#dfeee8] text-[#2c5f55]",
  }[tone];

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>
      {label}
    </span>
  );
}

export default function ComparePanel({ schools, onClose, onRemove }: ComparePanelProps) {
  return (
    <div className="flex h-full flex-col bg-[#f5f0e6] text-[#181713]">
      <div className="border-b border-black/10 bg-[#11130f] px-4 py-4 text-[#fff9ec]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d8b75d]">
              School Detail
            </div>
            <h2 className="mt-2 text-xl font-semibold leading-tight">
              学校对比
            </h2>
            <div className="mt-1 text-xs text-[#bdb5a4]">
              {schools.length} 所学校
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-[#d8caa6] transition hover:border-[#d8b75d]/60 hover:bg-[#d8b75d]/10"
            >
              返回列表
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {schools.map((school) => (
            <div
              key={school.name}
              className="flex w-[200px] shrink-0 flex-col rounded-lg border border-black/10 bg-[#fffaf0] shadow-sm"
            >
              <div className="border-b border-black/10 bg-[#f9f5ec] px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-tight text-[#181713]">
                    {school.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => onRemove(school)}
                    className="shrink-0 rounded-full p-1 text-[#9d3b25] transition hover:bg-[#f9ddd4]"
                    title="移除"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M2 2L10 10M10 2L2 10" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {school.is985 && <Tag label="985" tone="red" />}
                  {school.is211 && <Tag label="211" tone="gold" />}
                  {school.isDoubleFirstClass && <Tag label="双一流" tone="green" />}
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

                  <div className="h-px bg-black/10" />

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
                      <div className="h-px bg-black/10" />
                      <CompareRow
                        label="抓取时间"
                        value={school.detail.crawl_time.slice(0, 16)}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-black/10 px-3 py-2">
                <a
                  href={school.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-[#245d52] hover:text-[#173f38]"
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
      <span className="text-[#81786a]">{label}</span>
      <span className={`font-medium ${highlight ? "text-[#2c5f55]" : "text-[#4f4a40]"}`}>
        {value}
      </span>
    </div>
  );
}
