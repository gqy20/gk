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
    <div className="flex items-center gap-1 border-b border-border-light bg-white/60 px-3 py-2">
      <button
        type="button"
        onClick={() => {
          onTabChange("overview");
          setMenuOpen(false);
        }}
        className={cn(
          "relative h-8 rounded-full px-4 text-xs font-medium transition-colors",
          isOverview
            ? "text-green-600"
            : "text-dark-600 hover:text-dark-900 hover:bg-ink-100/60",
        )}
      >
        概览
        {isOverview && (
          <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-green-500" />
        )}
      </button>

      {detailTabs.length > 0 && (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            className={cn(
              "relative flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
              !isOverview
                ? "text-green-600"
                : "text-dark-600 hover:text-dark-900 hover:bg-ink-100/60",
            )}
          >
            <span className="truncate">
              {currentDetailTab ? currentDetailTab.label : "分类"}
            </span>
            <IconChevronDown
              size={11}
              className={cn("transition-transform", menuOpen && "rotate-180")}
            />
            {!isOverview && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-green-500" />
            )}
          </button>

          {menuOpen && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-[60vh] overflow-y-auto rounded-xl border border-border-light bg-white py-1 shadow-xl shadow-black/10"
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
                        "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs transition",
                        isActive
                          ? "font-semibold text-green-600 bg-green-50/70"
                          : "text-dark-800 hover:bg-ink-100/50",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                      {tab.count !== undefined && tab.count > 0 && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                            isActive
                              ? "bg-green-500 text-white"
                              : "bg-ink-200 text-dark-700",
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
      )}
    </div>
  );
}
