"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { DetailCategoryKey } from "@/lib/data";

export type TabKey = "overview" | "resources";
export type ResourceTabKey = DetailCategoryKey | "campus_sources";

interface TabNavProps {
  tabs: { key: TabKey; label: string; count?: number }[];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  resourceTabs: { key: ResourceTabKey; label: string; count?: number }[];
  activeResourceTab: ResourceTabKey | null;
  onResourceTabChange: (tab: ResourceTabKey) => void;
}

export default function TabNav({
  activeTab,
  onTabChange,
  resourceTabs,
  activeResourceTab,
  onResourceTabChange,
}: TabNavProps) {
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

  const isOverview = activeTab === "overview";
  const isResources = activeTab === "resources";
  const currentResourceTab = resourceTabs.find((tab) => tab.key === activeResourceTab);

  return (
    <div className="flex items-center gap-1 border-b border-border-light bg-neutral-0/45 px-3 py-2">
      <button
        type="button"
        onClick={() => {
          onTabChange("overview");
          setMenuOpen(false);
        }}
        className={cn(
          "relative h-8 rounded-md px-4 text-xs font-medium transition-colors",
          isOverview
            ? "text-brand-600"
            : "text-text-light-muted hover:text-text-light hover:bg-accent-50/70",
        )}
      >
        总览
        {isOverview && (
          <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-brand-500" />
        )}
      </button>

      {resourceTabs.length > 0 && (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              onTabChange("resources");
              setMenuOpen((open) => !open);
            }}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            className={cn(
              "relative flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
              isResources
                ? "text-brand-600"
                : "text-text-light-muted hover:text-text-light hover:bg-accent-50/70",
            )}
          >
            <span className="truncate">
              {isResources && currentResourceTab ? currentResourceTab.label : "资料库"}
            </span>
            <IconChevronDown
              size={11}
              className={cn("transition-transform", menuOpen && "rotate-180")}
            />
            {isResources && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-brand-500" />
            )}
          </button>

          {menuOpen && (
            <ul
              role="listbox"
              className="paper-card absolute left-0 top-full z-30 mt-1.5 max-h-[60vh] min-w-[180px] overflow-y-auto rounded-md border py-1"
            >
              {resourceTabs.map((tab) => {
                const isActive = activeResourceTab === tab.key;
                return (
                  <li key={String(tab.key)}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        onTabChange("resources");
                        onResourceTabChange(tab.key);
                        setMenuOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs transition",
                        isActive
                          ? "font-semibold text-brand-600 bg-success-soft/70"
                          : "text-text-light-secondary hover:bg-surface-light-subtle/50",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                      {tab.count !== undefined && tab.count > 0 && (
                        <span
                          className={cn(
                            "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
                            isActive
                              ? "bg-brand-500 text-text-inverse"
                              : "bg-surface-light-subtle text-text-light-muted",
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
