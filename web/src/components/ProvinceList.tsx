"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/Badge";
import { IconCheck } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { School, ProvinceData } from "@/lib/data";

// 滚动位置存储（跨导航保持）
const SCROLL_STORAGE_KEY = "gk-province-scroll";

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

  const listRef = useRef<HTMLDivElement>(null);
  const listKey = selectedProvince ?? "all";

  function getSavedScroll(): number | null {
    try {
      const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data[listKey] ?? null;
    } catch {
      return null;
    }
  }

  function saveScroll(pos: number) {
    try {
      const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data[listKey] = pos;
      sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  const hasSavedScroll = typeof window !== "undefined" && getSavedScroll() !== null;

  // 滚动位置记忆：保存 + 恢复
  const lastGoodScrollRef = useRef(getSavedScroll() ?? 0);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const saved = getSavedScroll();

    // 有保存的位置 → 恢复
    if (saved != null && saved > 0) {
      const restore = () => { el.scrollTop = saved; };
      if (hasSavedScroll) {
        requestAnimationFrame(() => requestAnimationFrame(restore));
      } else {
        setTimeout(restore, 800);
      }
    }

    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const pos = el.scrollTop;
      if (pos > 0) lastGoodScrollRef.current = pos;
      clearTimeout(timer);
      timer = setTimeout(() => { if (pos > 0) saveScroll(pos); }, 300);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      // 卸载时用最后有效位置（>0）保存，防止被布局重置的 0 覆盖
      if (lastGoodScrollRef.current > 0) {
        saveScroll(lastGoodScrollRef.current);
      }
      el.removeEventListener("scroll", onScroll);
    };
  }, [listKey]);

  return (
    <motion.div
      ref={listRef}
      className="min-h-0 flex-1 overflow-y-auto bg-surface-light p-3"
      variants={containerVariants}
      initial={hasSavedScroll ? "show" : "hidden"}
      animate="show"
      key={selectedProvince ?? "all"}
    >
      {displayProvinces.map((prov, idx) => {
        const doneCount = prov.schools.filter((school) => school.status === "done").length;
        const progress = Math.round((doneCount / Math.max(prov.schools.length, 1)) * 100);
        const isSelected = selectedProvince === prov.name;

        // 优先级排序: 985 > 211 > 双一流 > 普通; 同级按校名
        const sortedSchools = [...prov.schools].sort((a, b) => {
          const rankA = a.is985 ? 3 : a.is211 ? 2 : a.isDoubleFirstClass ? 1 : 0;
          const rankB = b.is985 ? 3 : b.is211 ? 2 : b.isDoubleFirstClass ? 1 : 0;
          if (rankA !== rankB) return rankB - rankA;
          return a.name.localeCompare(b.name, "zh-CN");
        });

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
                {sortedSchools.map((school, schoolIndex) => {
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
                        "flex items-center gap-2 px-3 py-2 text-xs transition sm:px-4 sm:py-2.5 cursor-pointer",
                        isSchoolSelected
                          ? "bg-green-50 text-[#1a342f]"
                          : "bg-white text-base-900 hover:bg-ink-100/80",
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
                          title={
                            isCompareSelected
                              ? "取消对比"
                              : canToggle
                                ? "加入对比"
                                : `已满 ${compareSchools.length} 所，先移除一个`
                          }
                          aria-pressed={isCompareSelected}
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full border-2 transition",
                            isCompareSelected
                              ? "border-green-500 bg-green-500 shadow-sm shadow-green-500/25"
                              : canToggle
                                ? "border-dashed border-dark-300 bg-white hover:border-green-400 hover:bg-green-50"
                                : "border-dashed border-dark-200 bg-white/60 cursor-not-allowed opacity-40",
                          )}
                        >
                          {isCompareSelected && <IconCheck size={12} className="text-white" />}
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
