"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { IconClose } from "@/components/ui/Icon";
import type { School } from "@/lib/data";

interface CompareBarProps {
  schools: School[];
  onRemove: (school: School) => void;
  onCompare: () => void;
  onClear: () => void;
}

export default function CompareBar({ schools, onRemove, onCompare, onClear }: CompareBarProps) {
  if (schools.length === 0) return null;

  return (
    <div className="border-t border-border-light bg-accent-50/45 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <AnimatePresence initial={false} mode="popLayout">
            {schools.map((school) => (
              <motion.span
                key={school.name || school.url}
                layout
                initial={{ opacity: 0, scale: 0.82 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.82 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                title={school.name}
                className="inline-flex items-center gap-1 rounded-md border border-border-light bg-neutral-0/72 py-0.5 pl-2 pr-1 text-xs text-text-light"
              >
                <span className="max-w-[140px] truncate">{school.name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(school)}
                  aria-label={`移除 ${school.name}`}
                  className="-mr-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-danger-400 transition hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                >
                  <IconClose size={12} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button theme="light" variant="danger" size="sm" onClick={onClear}>
            清空
          </Button>
          <Button
            theme="light"
            variant="primary"
            size="sm"
            onClick={onCompare}
            disabled={schools.length < 2}
          >
            对比
          </Button>
        </div>
      </div>
    </div>
  );
}
