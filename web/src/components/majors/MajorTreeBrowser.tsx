"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MajorCategory } from "@/types/majors";

interface MajorTreeBrowserProps {
  category: MajorCategory;
  selectedMenlei: string | null;
  onSelectMenlei: (key: string | null) => void;
}

export default function MajorTreeBrowser({
  category,
  selectedMenlei,
  onSelectMenlei,
}: MajorTreeBrowserProps) {
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  function toggleClass(key: string) {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {category.门类.map((menlei) => {
        const isSelected = selectedMenlei === menlei.key;
        const isExpanded = expandedClasses.has(menlei.key);

        return (
          <div key={menlei.key} className="mb-1">
            {/* 门类按钮 */}
            <button
              type="button"
              onClick={() => {
                onSelectMenlei(isSelected ? null : menlei.key);
                if (!isExpanded) toggleClass(menlei.key);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                isSelected
                  ? "bg-primary/15 text-primary"
                  : "text-dark-200 hover:bg-surface-active hover:text-text",
              )}
            >
              <span>{menlei.name}</span>
              <span className="text-[10px] text-dark-500">
                {menlei.major_count}
              </span>
            </button>

            {/* 展开的专业类列表 */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {menlei.专业类.map((cls) => (
                    <button
                      key={cls.key}
                      type="button"
                      onClick={() => onSelectMenlei(menlei.key)}
                      className="block w-full truncate border-l-2 border-border-subtle pl-5 py-1.5 text-[11px] text-dark-400 hover:text-text-light transition-colors"
                    >
                      {cls.name}
                      <span className="ml-1 text-dark-600">({cls.专业.length})</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
