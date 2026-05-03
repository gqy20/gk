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
    <div className="border-b border-border-light bg-base-950 px-4 py-4 text-text">
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

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-dark-300">
        <span className="rounded-full border border-border px-2.5 py-1">
          {school.province}
        </span>
        <a
          href={school.url}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-[230px] truncate rounded-full border border-primary-border px-2.5 py-1 text-gold-200 transition hover:border-primary/70 hover:text-gold-600"
        >
          {school.url.replace(/^https?:\/\//, "")}
        </a>
        <span className="ml-auto rounded-full border border-border px-2.5 py-1">
          {school.status === "done" ? "已采集" : "待采集"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {school.is985 && <Badge label="985" tone="red" />}
        {school.is211 && <Badge label="211" tone="gold" />}
        {school.isDoubleFirstClass && <Badge label="双一流" tone="green" />}
      </div>
    </div>
  );
}
