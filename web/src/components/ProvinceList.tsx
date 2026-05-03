"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { IconCheck } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { School, ProvinceData } from "@/lib/data";

interface ProvinceListProps {
  provinces: ProvinceData[];
  selectedProvince: string | null;
  selectedSchool: School | null;
  compareSchools: School[];
  onProvinceClick: (province: string) => void;
  onSchoolClick: (school: School) => void;
  onCompareToggle: (school: School) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 400, damping: 28 } },
};

const schoolVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 500, damping: 30 } },
};

export default function ProvinceList({
  provinces,
  selectedProvince,
  selectedSchool,
  compareSchools,
  onProvinceClick,
  onSchoolClick,
  onCompareToggle,
}: ProvinceListProps) {
  const displayProvinces = selectedProvince
    ? provinces.filter((p) => p.name === selectedProvince)
    : provinces;

  if (displayProvinces.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-dark-600">
        没有匹配的高校
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-0 flex-1 overflow-y-auto bg-surface-light p-3"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      key={selectedProvince ?? "all"}
    >
      {displayProvinces.map((prov, idx) => {
        const doneCount = prov.schools.filter((school) => school.status === "done").length;
        const progress = Math.round((doneCount / Math.max(prov.schools.length, 1)) * 100);
        const isSelected = selectedProvince === prov.name;

        return (
          <motion.div
            key={prov.name}
            variants={itemVariants}
            className="mb-3 overflow-hidden rounded-lg border border-border-light bg-ink-50"
          >
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onProvinceClick(prov.name)}
              className={cn(
                "w-full px-3 py-3 text-left transition",
                isSelected
                  ? "bg-green-500 text-text"
                  : "bg-ink-50 text-text-light hover:bg-ink-400",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-current/20 text-[11px] font-semibold tabular-nums">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{prov.name}</span>
                    <span className="rounded-full bg-current/10 px-2 py-0.5 text-xs font-semibold">
                      {prov.count} 所
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] opacity-65">
                    {doneCount} 已采集 · {progress}%
                  </div>
                </div>
              </div>
            </button>

            {(isSelected || !selectedProvince) && (
              <div className="border-t border-border-light bg-ink-100">
                {prov.schools.map((school, schoolIndex) => {
                  const isCompareSelected = compareSchools.some(
                    (s) => s.name === school.name,
                  );
                  const canToggle =
                    isCompareSelected || compareSchools.length < 3;
                  const isSchoolSelected = selectedSchool?.name === school.name;

                  return (
                    <motion.div
                      key={school.name}
                      variants={schoolVariants}
                      initial="hidden"
                      animate="show"
                      transition={{ delay: schoolIndex * 0.02 }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-xs transition sm:px-4 sm:py-2.5",
                        isSchoolSelected
                          ? "bg-green-50 text-[#1a342f]"
                          : "bg-white text-base-900 hover:bg-ink-100",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSchoolClick(school)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span
                          className={cn(
                            "h-2.5 w-2.5 flex-shrink-0 rounded-full",
                            school.status === "done" ? "bg-green-300" : "bg-dark-600",
                          )}
                        />
                        <span className="truncate font-medium">{school.name}</span>
                      </button>
                      <span className="flex flex-shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (canToggle) onCompareToggle(school);
                          }}
                          disabled={!canToggle}
                          title={isCompareSelected ? "取消对比" : "加入对比"}
                          aria-pressed={isCompareSelected}
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded border transition",
                            isCompareSelected
                              ? "border-green-500 bg-green-500 text-text"
                              : canToggle
                                ? "border-black/15 bg-white/60 text-transparent hover:border-green-400/50"
                                : "border-black/10 bg-black/5 text-transparent cursor-not-allowed opacity-50",
                          )}
                        >
                          <IconCheck size={12} />
                        </button>
                        <span className="flex gap-1">
                          {school.is985 && (
                            <Badge label="985" tone="red" size="sm" />
                          )}
                          {school.is211 && !school.is985 && (
                            <Badge label="211" tone="gold" size="sm" />
                          )}
                          {school.isDoubleFirstClass && !school.is985 && !school.is211 && (
                            <Badge label="双一流" tone="green" size="sm" />
                          )}
                        </span>
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
