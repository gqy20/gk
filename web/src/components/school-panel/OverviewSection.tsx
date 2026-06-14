"use client";

import type {
  DetailCategoryKey,
  MajorSatisfaction,
  School,
  UniversityInfo,
} from "@/lib/data";
import { DETAIL_CATEGORIES, CATEGORY_LABELS } from "@/lib/data";
import { EMPTY_MESSAGES } from "@/lib/constants";

interface OverviewSectionProps {
  detail?: UniversityInfo;
  school: School;
  onResourceSelect?: (category: DetailCategoryKey) => void;
}

export default function OverviewSection({
  detail,
  school,
  onResourceSelect,
}: OverviewSectionProps) {
  if (!detail) {
    return (
      <div className="space-y-4">
        {/* 阳光高考基础信息（即使无 detail 也可能显示） */}
        {school.detail?.basic_info && (
          <BasicInfoCard bi={school.detail.basic_info} />
        )}
        <div className="rounded-md border border-border-light bg-neutral-0/72 p-4 text-sm text-text-light-muted">
          <div className="font-semibold text-text-light">{EMPTY_MESSAGES.detailNotReady}</div>
        </div>
      </div>
    );
  }

  const filledCategories = DETAIL_CATEGORIES.filter(
    (key) => detail[key] && detail[key]!.length > 0,
  );

  return (
    <div className="space-y-4">
      {/* 阳光高考基础信息（始终显示，有数据时） */}
      {detail.basic_info && <BasicInfoCard bi={detail.basic_info} />}

      {/* 专业满意度（来自阳光高考 major_streaming） */}
      {detail.major_satisfaction && detail.major_satisfaction.length > 0 && (
        <MajorSatisfactionCard items={detail.major_satisfaction} />
      )}

      <section>
        <SectionTitle label={`资料库索引 ${filledCategories.length} 类`} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {filledCategories.map((key) => {
            const items = detail[key]!;
            return (
              <button
                type="button"
                key={key}
                onClick={() => onResourceSelect?.(key)}
                className="rounded-sm border border-border-light bg-neutral-0/72 px-2.5 py-1 text-[11px] text-text-light transition hover:border-brand-300 hover:bg-brand-50/45 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/50"
              >
                {CATEGORY_LABELS[key]} · {items.length}
              </button>
            );
          })}
        </div>
      </section>

      {detail.colleges && detail.colleges.length > 0 && (
        <section>
          <SectionTitle label={`学院列表 ${detail.colleges.length}`} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {detail.colleges.slice(0, 18).map((college, index) => (
              <span
                key={`${college.name || college.url || "college"}-${index}`}
                className="rounded-sm border border-border-light bg-neutral-0/72 px-2.5 py-1 text-[11px] text-text-light"
              >
                {college.name}
              </span>
            ))}
            {detail.colleges.length > 18 && (
              <span className="px-2.5 py-1 text-[11px] text-text-light-muted">
                +{detail.colleges.length - 18}
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <h3 className="text-[10px] font-semibold text-text-light-secondary">{label}</h3>
  );
}

/** 阳光高考基础信息卡片 */
function BasicInfoCard({ bi }: { bi: NonNullable<UniversityInfo["basic_info"]> }) {
  return (
    <section>
      <SectionTitle label="基础信息" />
      <div className="mt-2 space-y-2 rounded-md border border-brand-200/60 bg-brand-50/45 p-3 text-xs">
        {bi.address && (
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-blue-600">📍</span>
            <span className="text-text-light">{bi.address}</span>
          </div>
        )}
        {bi.phone && (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-blue-600">📞</span>
            <span>{bi.phone}</span>
          </div>
        )}
        {bi.enrollment_website && (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-blue-600">📋</span>
            <a
              href={bi.enrollment_website.startsWith("http") ? bi.enrollment_website : `https://${bi.enrollment_website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-blue-700 hover:text-blue-600 transition"
            >
              {bi.enrollment_website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

/** 专业满意度卡片（来自阳光高考学生评分） */
function MajorSatisfactionCard({ items }: { items: MajorSatisfaction[] }) {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 8);
  const avg = (items.reduce((s, i) => s + i.score, 0) / items.length).toFixed(1);

  const scoreColor = (score: number) => {
    if (score >= 4.5) return "bg-brand-400";
    if (score >= 4.0) return "bg-yellow-400";
    if (score >= 3.5) return "bg-orange-400";
    return "bg-danger-300";
  };

  return (
    <section>
      <SectionTitle label={`专业满意度 (${items.length})`} />
      <div className="mt-2 space-y-2 rounded-md border border-accent-200/70 bg-accent-50/45 p-3 text-xs">
        {/* 平均分 */}
        <div className="flex items-center justify-between">
          <span className="text-text-light-muted">平均满意度</span>
          <span className="text-base font-bold text-orange-600">{avg}</span>
        </div>

        {/* Top 专业列表 */}
        <div className="space-y-1.5">
          {top.map((item, idx) => (
            <div key={item.title} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-[10px] font-semibold text-orange-500/70">
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-text-light">
                {item.title}
              </span>
              <div className="flex items-center gap-1.5">
                {/* 评分条 */}
                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-black/5">
                  <div
                    className={`h-full rounded-full transition-all ${scoreColor(item.score)}`}
                    style={{ width: `${(item.score / 5) * 100}%` }}
                  />
                </div>
                <span className="w-7 text-right text-[11px] font-semibold tabular-nums text-orange-700">
                  {item.score.toFixed(1)}
                </span>
                <span className="w-8 text-right text-[9px] text-text-muted">
                  ({item.votes}人)
                </span>
              </div>
            </div>
          ))}
        </div>

        {items.length > 8 && (
          <p className="text-center text-[10px] text-text-muted">
            还有 {items.length - 8} 个专业
          </p>
        )}
      </div>
    </section>
  );
}
