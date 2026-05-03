"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { School, UniversityInfo } from "@/lib/data";

interface SchoolPopupProps {
  school: School;
  onEnterDetail: (school: School) => void;
  onClose: () => void;
}

export default function SchoolPopup({
  school,
  onEnterDetail,
  onClose,
}: SchoolPopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const detail = school.detail as UniversityInfo | undefined;

  const filledCategories = detail
    ? Object.keys(detail).filter(
        (k) =>
          k !== "university" &&
          k !== "missing_categories" &&
          k !== "notes" &&
          k !== "crawl_time" &&
          k !== "colleges" &&
          Array.isArray((detail as unknown as Record<string, unknown>)[k]) &&
          ((detail as unknown as Record<string, unknown>)[k] as unknown[]).length > 0,
      )
    : [];

  return (
    <div
      ref={ref}
      className="absolute left-1/2 top-[15%] z-20 w-[280px] -translate-x-1/2 rounded-xl border border-primary-border bg-surface-elevated p-4 shadow-2xl shadow-black/40"
    >
      {/* 标题区 */}
      <div className="mb-2.5">
        <h3 className="text-base font-semibold leading-tight text-dark-50">
          {school.name}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-dark-500">
          <span className="rounded-full border border-border-subtle bg-white/[0.05] px-2 py-0.5">
            {school.province}
          </span>
          <a
            href={school.url}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[140px] truncate text-gold-600 hover:text-gold-500"
          >
            {school.url.replace(/^https?:\/\//, "")}
          </a>
        </div>
      </div>

      {/* 标签行 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {school.is985 && <Badge label="985" tone="red" />}
        {school.is211 && <Badge label="211" tone="gold" />}
        {school.isDoubleFirstClass && <Badge label="双一流" tone="green" />}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            school.status === "done"
              ? "border border-green-500/30 bg-green-500/10 text-green-400"
              : "border border-border-subtle bg-white/[0.04] text-dark-500"
          }`}
        >
          {school.status === "done" ? "已采集" : "待采集"}
        </span>
      </div>

      {/* 简要统计 */}
      {detail && (
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          <StatCell
            label="信息完整度"
            value={`${filledCategories.length}/11 类`}
          />
          <StatCell label="学院" value={`${detail.colleges?.length ?? 0} 个`} />
        </div>
      )}

      {/* 操作按钮 */}
      <Button
        theme="dark"
        variant="primary"
        size="sm"
        className="w-full"
        onClick={() => onEnterDetail(school)}
      >
        查看详情
      </Button>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-light bg-base-50 px-2.5 py-1.5">
      <div className="text-[10px] text-dark-700">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-text-light">{value}</div>
    </div>
  );
}
