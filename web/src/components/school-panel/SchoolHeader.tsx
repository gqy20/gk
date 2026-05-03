"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { School } from "@/lib/data";

interface SchoolHeaderProps {
  school: School;
  onClose?: () => void;
}

export default function SchoolHeader({ school, onClose }: SchoolHeaderProps) {
  return (
    <div className="border-b border-border-light bg-ink-100 px-3 py-3 text-text-light sm:px-4 sm:py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold leading-tight">
            {school.name}
          </h2>
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
        <span className="ml-auto rounded-full border border-border-light bg-ink-50 px-2.5 py-1 text-dark-600">
          {school.status === "done" ? "已采集" : "待采集"}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-3">
        {school.is985 && <Badge label="985" tone="red" />}
        {school.is211 && <Badge label="211" tone="gold" />}
        {school.isDoubleFirstClass && <Badge label="双一流" tone="green" />}
      </div>
    </div>
  );
}
