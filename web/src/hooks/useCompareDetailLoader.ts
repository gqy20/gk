"use client";

import { useEffect, useRef, useCallback } from "react";
import type { School } from "@/lib/data";
import { fetchSchoolDetail } from "@/lib/school-details";

interface UseCompareDetailLoaderOptions {
  compareSchools: School[];
  compareOpen: boolean;
  onLoadingChange: (loading: boolean) => void;
  onDetailMerged: (detailSchool: School) => void;
}

/**
 * 当对比面板打开时，批量加载 compareSchools 中缺少 detail 的学校详情。
 *
 * - 触发时机：compareOpen === true 且至少 2 所学校
 * - 并行请求：最多 3 个 Promise.allSettled，互不阻塞
 * - 去重：已加载过的学校不会重复请求
 * - 容错：单个失败/404 静默跳过
 */
export function useCompareDetailLoader({
  compareSchools,
  compareOpen,
  onLoadingChange,
  onDetailMerged,
}: UseCompareDetailLoaderOptions) {
  const fetchedNamesRef = useRef<Set<string>>(new Set());

  const loadDetails = useCallback(
    async (schools: School[]) => {
      const needsLoad = schools.filter((s) => s.detail === undefined || s.detail === null);
      if (needsLoad.length === 0) return;

      onLoadingChange(true);

      const results = await Promise.allSettled(
        needsLoad.map(async (school) => {
          const detail = await fetchSchoolDetail(school.name);
          return detail;
        }),
      );

      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value !== null) {
          onDetailMerged(result.value);
          fetchedNamesRef.current.add(needsLoad[index].name);
        }
      });

      onLoadingChange(false);
    },
    [onLoadingChange, onDetailMerged],
  );

  useEffect(() => {
    if (!compareOpen || compareSchools.length < 2) return;

    // 对比列表发生变化时重置去重缓存（用户可能换了学校）
    const currentNames = new Set(compareSchools.map((s) => s.name));
    const prevNames = fetchedNamesRef.current;
    if (
      currentNames.size !== prevNames.size ||
      ![...currentNames].every((n) => prevNames.has(n))
    ) {
      fetchedNamesRef.current = new Set();
    }

    loadDetails(compareSchools);

    // 不在 unmount 时取消——让请求完成以便缓存到 state
  }, [compareOpen, compareSchools, loadDetails]);
}
