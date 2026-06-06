"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { School, UniversityInfo } from "@/lib/data";
import { STATUS_LABELS, STAT_LABELS } from "@/lib/constants";

interface SchoolPopupProps {
  school: School;
  onClose: () => void;
}

export default function SchoolPopup({
  school,
  onClose,
}: SchoolPopupProps) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeydown);
    };
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
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label={`${school.name} — 学校预览`}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="paper-card absolute left-1/2 top-[15%] z-20 w-[280px] -translate-x-1/2 rounded-lg border p-4 shadow-2xl shadow-neutral-900/12"
    >
      {/* 标题区 */}
      <div className="mb-2.5">
        <h3 className="text-base font-semibold leading-tight text-text">
          {school.name}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
          <span className="rounded-sm border border-border-subtle bg-accent-50/65 px-2 py-0.5">
            {school.province}
          </span>
          <a
            href={school.url}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[140px] truncate text-accent-600 hover:text-accent-500"
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
          className={`rounded-sm px-2 py-0.5 text-[10px] font-medium ${
            school.status === "done"
              ? "border border-brand-500/30 bg-brand-50 text-brand-700"
              : "border border-border-subtle bg-neutral-900/5 text-text-muted"
          }`}
        >
          {school.status === "done" ? STATUS_LABELS.done : STATUS_LABELS.pending}
        </span>
      </div>

      {/* 简要统计 */}
      {detail && (
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          <StatCell
            label={STAT_LABELS.infoComplete}
            value={`${filledCategories.length}/11 类`}
          />
          <StatCell label={STAT_LABELS.college} value={`${detail.colleges?.length ?? 0} ${STAT_LABELS.unit}`} />
        </div>
      )}

      {/* 操作按钮 */}
      <Button
        theme="light"
        variant="primary"
        size="sm"
        className="w-full"
        onClick={() => router.push(`/school/${encodeURIComponent(school.name)}`)}
      >
        查看详情
      </Button>
    </motion.div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-light bg-neutral-0/70 px-2.5 py-1.5">
      <div className="text-[10px] text-text-light-muted">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-text-light">{value}</div>
    </div>
  );
}
