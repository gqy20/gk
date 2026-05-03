"use client";

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  type ReactNode,
} from "react";
import { appReducer, initialState, type AppState, type AppAction } from "@/lib/app-state";
import type { School } from "@/lib/data";

interface DerivedState {
  filteredSchools: School[];
  filteredProvinces: { name: string; count: number; schools: School[] }[];
  doneCount: number;
  filteredDoneCount: number;
  activeFilterCount: number;
  contextLabel: string;
}

interface AppContextValue extends AppState, DerivedState {
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export default function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const derived = useMemo<DerivedState>(() => {
    const { data, query, filter985, filter211, filterDoubleFirst, selectedProvince, selectedSchool } = state;

    const filteredSchools = (() => {
      if (!data) return [];
      let result = data.schools;
      const keyword = query.trim().toLowerCase();
      if (keyword) {
        result = result.filter((school) => {
          const haystack = `${school.name} ${school.province} ${school.url}`.toLowerCase();
          return haystack.includes(keyword);
        });
      }
      if (filter985) result = result.filter((s) => s.is985);
      if (filter211) result = result.filter((s) => s.is211);
      if (filterDoubleFirst) result = result.filter((s) => s.isDoubleFirstClass);
      return result;
    })();

    const filteredProvinces = (() => {
      const provMap = new Map<string, School[]>();
      for (const s of filteredSchools) {
        const list = provMap.get(s.province) || [];
        list.push(s);
        provMap.set(s.province, list);
      }
      return Array.from(provMap.entries())
        .map(([name, schools]) => ({ name, count: schools.length, schools }))
        .sort((a, b) => b.count - a.count);
    })();

    const doneCount = data?.schools.filter((s) => s.status === "done").length ?? 0;
    const filteredDoneCount = filteredSchools.filter((s) => s.status === "done").length;
    const activeFilterCount = [filter985, filter211, filterDoubleFirst].filter(Boolean).length;

    const contextLabel = selectedSchool
      ? selectedSchool.name
      : selectedProvince
        ? `${selectedProvince} · ${filteredSchools.filter((s) => s.province === selectedProvince).length} 所`
        : "全国高校";

    return {
      filteredSchools,
      filteredProvinces,
      doneCount,
      filteredDoneCount,
      activeFilterCount,
      contextLabel,
    };
  }, [state]);

  const value = useMemo(() => ({ ...state, ...derived, dispatch }), [state, derived]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
