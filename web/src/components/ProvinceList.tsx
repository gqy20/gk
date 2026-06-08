"use client";

import { useCallback, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/Badge";
import { IconCheck } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { EMPTY_MESSAGES } from "@/lib/constants";
import type { School, ProvinceData } from "@/lib/data";
import { getProvincePalette } from "@/lib/map-style";

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

  const listRef = useRef<HTMLDivElement>(null);
  const listKey = selectedProvince ?? "all";

  const getSavedScroll = useCallback((): number | null => {
    try {
      const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data[listKey] ?? null;
    } catch {
      return null;
    }
  }, [listKey]);

  const saveScroll = useCallback((pos: number) => {
    try {
      const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data[listKey] = pos;
      sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [listKey]);

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
  }, [getSavedScroll, hasSavedScroll, saveScroll]);

  if (displayProvinces.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-text-light-muted">
        {EMPTY_MESSAGES.noSchools}
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="paper-shell min-h-0 flex-1 overflow-y-auto p-3"
      key={selectedProvince ?? "all"}
    >
      {displayProvinces.map((prov) => {
        const isSelected = selectedProvince === prov.name;
        const compactProvinceHeader = Boolean(selectedProvince);
        const palette = getProvincePalette(prov.name);

        // 优先级排序: 985 > 211 > 双一流 > 普通; 同级按校名
        const sortedSchools = [...prov.schools].sort((a, b) => {
          const rankA = a.is985 ? 3 : a.is211 ? 2 : a.isDoubleFirstClass ? 1 : 0;
          const rankB = b.is985 ? 3 : b.is211 ? 2 : b.isDoubleFirstClass ? 1 : 0;
          if (rankA !== rankB) return rankB - rankA;
          return a.name.localeCompare(b.name, "zh-CN");
        });

        return (
          <div
            key={prov.name}
            className="mb-3 overflow-hidden rounded-md border border-border-light bg-neutral-0/72 shadow-sm shadow-neutral-900/5"
          >
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onProvinceClick(prov.name)}
              className={cn(
                "w-full px-3 text-left transition",
                compactProvinceHeader ? "py-2.5" : "py-3",
                isSelected
                  ? ""
                  : "bg-neutral-0/66 text-text-light hover:bg-accent-50/60",
              )}
              style={isSelected ? { background: palette.selectedFill, color: palette.label } : undefined}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  {!compactProvinceHeader && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold">{prov.name}</span>
                      <span className="rounded-sm border border-current/15 bg-current/10 px-2 py-0.5 text-xs font-semibold">
                        {prov.count} 所
                      </span>
                    </div>
                  )}
                  {compactProvinceHeader && (
                    <div className="text-xs font-medium opacity-72">
                      {prov.count} 所高校
                    </div>
                  )}
                </div>
              </div>
            </button>

            {(isSelected || !selectedProvince) && (
              <div
                className="border-t border-border-light bg-accent-50/25"
                style={isSelected ? { background: palette.halo } : undefined}
              >
                {sortedSchools.map((school) => {
                  const isCompareSelected = compareSchools.some(
                    (s) => s.name === school.name,
                  );
                  const canToggle =
                    isCompareSelected || compareSchools.length < 3;
                  const isSchoolSelected = selectedSchool?.name === school.name;

                  return (
                    <div
                      key={school.name}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 border-b border-border-light-subtle px-3 py-2 text-xs transition last:border-b-0 sm:px-4 sm:py-2.5",
                        isSchoolSelected
                          ? "bg-success-soft/85 text-brand-700"
                          : "bg-neutral-0/58 text-text-light hover:bg-neutral-0/88",
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
                            school.status === "done" ? "" : "bg-neutral-400",
                          )}
                          style={school.status === "done" ? { background: palette.selectedFill } : undefined}
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
                              ? "border-brand-500 bg-brand-500 shadow-sm shadow-brand-500/20"
                              : canToggle
                                ? "border-dashed border-neutral-300 bg-neutral-0/80 hover:border-brand-400 hover:bg-success-soft"
                                : "border-dashed border-neutral-200 bg-neutral-0/60 cursor-not-allowed opacity-40",
                          )}
                        >
                          {isCompareSelected && <IconCheck size={12} className="text-text-inverse" />}
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
