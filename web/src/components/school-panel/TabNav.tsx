"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { DetailCategoryKey } from "@/lib/data";

export type TabKey = "overview" | DetailCategoryKey;

interface TabNavProps {
  tabs: { key: TabKey; label: string; count?: number }[];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export default function TabNav({ tabs, activeTab, onTabChange }: TabNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const detailTabs = tabs.filter((tab) => tab.key !== "overview");
  const isOverview = activeTab === "overview";
  const currentDetailTab = detailTabs.find((tab) => tab.key === activeTab);

  return (
    <div className="flex items-center gap-2 border-b border-border-light bg-ink-600 px-3 py-2">
      <button
        type="button"
        onClick={() => {
          onTabChange("overview");
          setMenuOpen(false);
        }}
        className={cn(
          "h-8 shrink-0 rounded-full border px-3.5 text-xs font-medium transition",
          isOverview
            ? "border-green-500 bg-green-500 text-text"
            : "border-border-light bg-base-50 text-dark-900 hover:border-green-400/40 hover:text-green-500",
        )}
      >
        概览
      </button>

      {detailTabs.length > 0 && (
        <>
          <span className="h-5 w-px bg-border-light" aria-hidden="true" />
          <div ref={menuRef} className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-shadow duration-200",
                !isOverview
                  ? "border-green-500 bg-green-500 text-white shadow-sm shadow-green-500/25"
                  : "border-border-light bg-base-50 text-dark-900 hover:border-green-400/40 hover:text-green-500 hover:shadow-sm",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-left">
                {currentDetailTab ? currentDetailTab.label : `选择分类 · ${detailTabs.length} 项`}
              </span>
              {currentDetailTab && currentDetailTab.count !== undefined && currentDetailTab.count > 0 && (
                <span className="shrink-0 opacity-70">{currentDetailTab.count}</span>
              )}
              <IconChevronDown
                size={12}
                className={cn("transition-transform", menuOpen && "rotate-180")}
              />
            </button>

            {menuOpen && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-[60vh] overflow-y-auto rounded-lg border border-border-light bg-ink-50 py-1 shadow-xl shadow-black/15"
              >
                {detailTabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <li key={String(tab.key)}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          onTabChange(tab.key);
                          setMenuOpen(false);
                        }}
                        className={cn(
                          "relative flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs transition",
                          isActive
                            ? "bg-green-50 font-semibold text-green-600"
                            : "text-dark-950 hover:bg-ink-500",
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-green-500 rounded-r" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              isActive
                                ? "bg-green-500 text-text"
                                : "bg-ink-700 text-dark-900",
                            )}
                          >
                            {tab.count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
