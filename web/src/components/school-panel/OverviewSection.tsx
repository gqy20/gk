"use client";

import { cn } from "@/lib/utils";
import type { DocItem, School, UniversityInfo } from "@/lib/data";
import { DETAIL_CATEGORIES, CATEGORY_LABELS } from "@/lib/data";

interface OverviewSectionProps {
  detail?: UniversityInfo;
  school: School;
}

export default function OverviewSection({ detail, school }: OverviewSectionProps) {
  if (!detail) {
    return (
      <div className="rounded-lg border border-border-light bg-ink-50 p-4 text-sm text-dark-600">
        <div className="font-semibold text-text-light">详情数据未完成</div>
        <div className="mt-2 text-xs">
          当前状态：{school.status === "done" ? "已完成" : "等待采集"}
        </div>
      </div>
    );
  }

  const filledCategories = DETAIL_CATEGORIES.filter(
    (key) => detail[key] && detail[key]!.length > 0,
  );
  const missingCount = detail.missing_categories?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <InfoRow label="抓取时间" value={detail.crawl_time?.slice(0, 16) || "-"} />
        <InfoRow
          label="信息完整度"
          value={`${filledCategories.length}/${DETAIL_CATEGORIES.length} 类`}
        />
        <InfoRow label="学院" value={`${detail.colleges?.length ?? 0} 个`} />
        <InfoRow
          label="缺失类别"
          value={`${missingCount} 类`}
          warn={missingCount > 0}
        />
      </div>

      {detail.notes && (
        <div className="rounded-lg border border-primary-border bg-gold-50 p-3 text-xs leading-relaxed text-gold-800">
          {detail.notes}
        </div>
      )}

      <section>
        <SectionTitle label={`已获取信息 ${filledCategories.length} 类`} />
        <div className="mt-2 space-y-2">
          {filledCategories.map((key) => {
            const items = detail[key]!;
            return (
              <div key={key} className="rounded-lg border border-border-light bg-ink-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-text-light">
                    {CATEGORY_LABELS[key]}
                  </span>
                  <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-dark-900">
                    {items.length} 条
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {items.slice(0, 3).map((item, index) => (
                    <DocItemMini key={index} item={item as DocItem} />
                  ))}
                  {items.length > 3 && (
                    <p className="text-xs text-dark-600">
                      还有 {items.length - 3} 条
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {detail.colleges && detail.colleges.length > 0 && (
        <section>
          <SectionTitle label={`学院列表 ${detail.colleges.length}`} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {detail.colleges.slice(0, 18).map((college) => (
              <span
                key={college.name}
                className="rounded-full border border-border-light bg-ink-50 px-2.5 py-1 text-[11px] text-dark-950"
              >
                {college.name}
              </span>
            ))}
            {detail.colleges.length > 18 && (
              <span className="px-2.5 py-1 text-[11px] text-dark-600">
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
    <h3 className="text-[10px] font-semibold text-dark-800">
      {label}
    </h3>
  );
}

function InfoRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border-light bg-ink-50 p-3">
      <div className="text-[10px] text-dark-800 font-medium">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate text-sm font-semibold",
          warn ? "text-red-600" : "text-text-light",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DocItemMini({ item }: { item: DocItem }) {
  return (
    <div className="border-l-2 border-primary-border pl-2 transition hover:border-green-400">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="line-clamp-1 text-xs font-medium text-green-800 hover:text-green-700"
      >
        {item.title}
      </a>
      {item.summary && (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-dark-600">
          {item.summary}
        </p>
      )}
      {item.attachments?.length > 0 && (
        <span className="mt-1 inline-block rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-400">
          附件 {item.attachments.length}
        </span>
      )}
    </div>
  );
}
