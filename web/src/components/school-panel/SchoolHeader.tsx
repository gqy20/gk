"use client";

import { Badge } from "@/components/ui/Badge";
import type { School } from "@/lib/data";

interface SchoolHeaderProps {
  school: School;
  onClose?: () => void;
}

export default function SchoolHeader({
  school,
  onClose,
}: SchoolHeaderProps) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border-light bg-ink-100 px-3 py-2.5 sm:px-4 sm:py-3">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-dark-500 transition hover:bg-ink-300 hover:text-text-light"
          aria-label="返回地图"
        >
          ←
        </button>
      )}
      <a
        href={school.url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 truncate text-base font-semibold text-text-light transition hover:text-green-400 sm:text-lg"
      >
        {school.name}
      </a>
      <span className="rounded-full border border-border-light bg-ink-50 px-2 py-0.5 text-[11px] text-dark-600">
        {school.province}
      </span>
      <span className="ml-auto flex flex-wrap gap-1">
        {school.is985 && <Badge label="985" tone="red" />}
        {school.is211 && <Badge label="211" tone="gold" />}
        {school.isDoubleFirstClass && <Badge label="双一流" tone="green" />}
      </span>
    </div>
  );
}
