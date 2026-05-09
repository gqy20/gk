"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { School } from "@/lib/data";
import {
  CRAWL_CATEGORIES,
  CRAWL_CATEGORY_LABELS,
  type CategoryStatus,
  type CrawlStatusMap,
} from "@/lib/crawl-data";

interface SchoolHeaderProps {
  school: School;
  onClose?: () => void;
  crawlStatus?: CrawlStatusMap | null;
  onCategoryClick?: (category: string) => void;
  activeCrawlCategory?: string | null;
}

export default function SchoolHeader({
  school,
  onClose,
  crawlStatus,
  onCategoryClick,
  activeCrawlCategory,
}: SchoolHeaderProps) {
  const statusMap = crawlStatus?.[school.name];

  return (
    <div className="border-b border-border-light bg-ink-100 px-3 py-3 text-text-light sm:px-4 sm:py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold leading-tight">{school.name}</h2>
        </div>
        {onClose && (
          <Button theme="dark" variant="secondary" size="sm" onClick={onClose}>
            返回列表
          </Button>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-dark-700 sm:mt-3 sm:gap-2">
        <span className="rounded-full border border-border-light bg-ink-50 px-2.5 py-1 text-dark-600">
          {school.province}
        </span>
        <a
          href={school.url}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-[230px] truncate rounded-full border border-primary-border bg-ink-50 px-2.5 py-1 text-gold-700 transition hover:border-primary/70 hover:text-gold-600"
        >
          {school.url.replace(/^https?:\/\//, "")}
        </a>
        <span className="rounded-full border border-border-light bg-ink-50 px-2.5 py-1 text-dark-600">
          {school.status === "done" ? "已采集" : "待采集"}
        </span>
      </div>

      {statusMap && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-2.5">
          {CRAWL_CATEGORIES.map((cat) => {
            const cs = statusMap[cat] as CategoryStatus | undefined;
            const info = CRAWL_CATEGORY_LABELS[cat];
            if (!cs) return null;
            return (
              <CategoryDot
                key={cat}
                icon={info.icon}
                label={info.label}
                status={cs.status}
                isActive={activeCrawlCategory === cat}
                onClick={() => onCategoryClick?.(cat)}
              />
            );
          })}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-3">
        {school.is985 && <Badge label="985" tone="red" />}
        {school.is211 && <Badge label="211" tone="gold" />}
        {school.isDoubleFirstClass && <Badge label="双一流" tone="green" />}
      </div>
    </div>
  );
}

function CategoryDot({
  icon,
  label,
  status,
  isActive,
  onClick,
}: {
  icon: string;
  label: string;
  status: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const dotSize = "h-2 w-2";
  const dot =
    status === "done"
      ? `bg-green-500 ${dotSize} rounded-full shadow-sm shadow-green-500/30`
      : status === "failed"
        ? `bg-red-400 ${dotSize} rounded-full shadow-sm shadow-red-500/30`
        : status === "in_progress"
          ? `bg-yellow-400 ${dotSize} rounded-full animate-pulse`
          : `border-2 border-dark-300 ${dotSize} rounded-full bg-transparent`;

  const statusIcon =
    status === "done" ? (
      <span className="text-[10px] font-semibold text-green-500 leading-none">✓</span>
    ) : status === "failed" ? (
      <span className="text-[10px] font-semibold text-red-400 leading-none">✗</span>
    ) : null;

  if (!onClick) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-ink-50 px-2.5 py-1 text-[10px] text-dark-700"
        title={`${label}: ${status}`}
      >
        <span className={dot} />
        {icon} {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={`查看${label}信息来源`}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
        isActive
          ? "border-green-400 bg-green-50 text-green-600 shadow-md shadow-green-500/20"
          : "border-border-light bg-ink-50 text-dark-700 hover:border-green-400/50 hover:bg-ink-100 hover:shadow-sm",
      )}
    >
      <span className={dot} />
      {statusIcon || <span>{icon}</span>}
      {!statusIcon && <span>{label}</span>}
    </button>
  );
}
