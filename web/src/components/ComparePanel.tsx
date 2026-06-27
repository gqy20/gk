"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconClose, IconChevronDown } from "@/components/ui/Icon";
import type { School, DetailCategoryKey, DocItem, CollegeItem, MajorSatisfaction, StudentExperienceItem } from "@/lib/data";
import { STAT_LABELS } from "@/lib/constants";
import { CATEGORY_LABELS, DETAIL_CATEGORIES } from "@/lib/data";

// ─── Types ──────────────────────────────────────────────

interface ComparePanelProps {
  schools: School[];
  onClose: () => void;
  onRemove: (school: School) => void;
  loading?: boolean;
}

const ALL_CATEGORIES: DetailCategoryKey[] = [
  ...DETAIL_CATEGORIES,
  "colleges",
  "student_experiences",
];

// ─── Helpers ─────────────────────────────────────────────

function getCategoryCount(school: School, key: DetailCategoryKey): number {
  if (!school.detail) return 0;
  const items = school.detail[key];
  return Array.isArray(items) ? items.length : 0;
}

/** 取前 N 条文档的标题+摘要，用于展开详情预览 */
function previewDocs(items: DocItem[], max = 3): DocItem[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, max).map((item) => ({
    ...item,
    summary: item.summary?.slice(0, 80) ?? "",
  }));
}

function previewColleges(colleges: CollegeItem[], max = 6): CollegeItem[] {
  if (!Array.isArray(colleges)) return [];
  return colleges.slice(0, max);
}

// ─── Sub-components ───────────────────────────────────────

function CompareRow({
  label,
  value,
  isBest,
}: {
  label: string;
  value: string;
  isBest?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-text-light-muted shrink-0">{label}</span>
      <span
        className={`tabular-nums ${isBest ? "font-semibold text-brand-500" : "font-medium text-text-light"}`}
      >
        {value}
      </span>
    </div>
  );
}

/** 展开的学校详情区域（精简版，复用 SchoolPanel 的展示逻辑） */
function ExpandedDetail({ school }: { school: School }) {
  const detail = school.detail;
  if (!detail) {
    return (
      <p className="px-4 py-8 text-center text-sm text-text-light-muted">
        暂无详细信息
      </p>
    );
  }

  // 有数据的分类（排除全零的）
  const filledCategories = ALL_CATEGORIES.filter(
    (key) => {
      const count = getCategoryCount(school, key);
      return count > 0;
    },
  );

  return (
    <div className="space-y-3 border-t border-border-light pt-3 mt-3">
      {/* 基础信息 */}
      {detail.basic_info && (
        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-light-secondary">
            基础信息
          </h4>
          <div className="mt-1.5 space-y-1 rounded-md bg-surface-subtle p-2.5 text-xs">
            {detail.basic_info.address && (
              <div className="flex items-start gap-1.5 text-text-light">
                <span className="shrink-0">📍</span>
                {detail.basic_info.address}
              </div>
            )}
            {detail.basic_info.phone && (
              <div className="flex items-start gap-1.5 text-text-light">
                <span className="shrink-0">📞</span>
                {detail.basic_info.phone}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 专业满意度 */}
      {detail.major_satisfaction && detail.major_satisfaction.length > 0 && (
        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-light-secondary">
            专业满意度
          </h4>
          <div className="mt-1.5 space-y-1 rounded-md bg-accent-50/50 p-2.5 text-xs">
            {detail.major_satisfaction
              .slice()
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
              .map((item) => (
                <div key={item.title} className="flex items-center gap-2">
                  <span className="min-w-0 truncate font-medium text-text-light">
                    {item.title}
                  </span>
                  <span className="shrink-0 tabular-nums text-orange-600">
                    {item.score.toFixed(1)}
                  </span>
                  <span className="shrink-0 text-[10px] text-text-muted">
                    ({item.votes}人)
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      /* 学院列表 */
      {detail.colleges && detail.colleges.length > 0 && (
        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-light-secondary">
            学院列表 · {detail.colleges.length}
          </h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {previewColleges(detail.colleges).map((c) => (
              <span
                key={c.name}
                className="rounded-sm border border-border-light bg-neutral-0/60 px-2 py-1 text-[11px] text-text-light"
              >
                {c.name}
              </span>
            ))}
            {detail.colleges.length > 6 && (
              <span className="px-2 py-1 text-[11px] text-text-muted self-center">
                +{detail.colleges.length - 6}
              </span>
            )}
          </div>
        </section>
      )}

      /* 各分类资料 */
      {filledCategories.map((key) => {
        const items = detail[key];
        if (!Array.isArray(items) || items.length === 0) return null;

        const label = CATEGORY_LABELS[key];

        // FAQ 特殊渲染
        if (key === "faq") {
          const docs = items as DocItem[];
          return (
            <section key={key}>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-light-secondary">
                {label} · {docs.length}
              </h4>
              <div className="mt-1.5 space-y-2">
                {previewDocs(docs).map((doc, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-brand-200/50 bg-brand-50/40 p-2.5 text-xs"
                  >
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-600 hover:text-brand-400"
                    >
                      {doc.title}
                    </a>
                    {doc.summary && (
                      <p className="mt-1 line-clamp-2 text-text-light">
                        {doc.summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // 学生经验特殊渲染
        if (key === "student_experiences") {
          const exps = items as StudentExperienceItem[];
          return (
            <section key={key}>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-light-secondary">
                {label} · {exps.length}
              </h4>
              <div className="mt-1.5 space-y-2">
                {exps.slice(0, 3).map((exp, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-primary-border/40 bg-accent-50/60 p-2.5 text-xs"
                  >
                    <div className="font-medium text-accent-700">{exp.topic}</div>
                    <p className="mt-1 line-clamp-2 text-text-light">{exp.content}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // 通用文档列表
        const docs = items as DocItem[];
        return (
          <section key={key}>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-light-secondary">
              {label} · {docs.length}
            </h4>
            <div className="mt-1.5 space-y-1.5">
              {previewDocs(docs).map((doc, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border-light bg-neutral-0/60 p-2.5 text-xs transition hover:border-brand-300/45 hover:bg-brand-50/30"
                >
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand-500 hover:text-brand-400"
                  >
                    {doc.title}
                  </a>
                  {doc.summary && (
                    <p className="mt-1 line-clamp-2 text-text-light">{doc.summary}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {/* 官网 */}
      {school.url && (
        <div className="border-t border-border-light pt-3 mt-1">
          <a
            href={school.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-100 transition"
          >
            访问官网 ↗
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────

export default function ComparePanel({
  schools,
  onClose,
  onRemove,
  loading = false,
}: ComparePanelProps) {
  const [expandedName, setExpandedName] = useState<string | null>(null);

  // 预计算每个维度在所有学校中的最大值
  const maxCounts = useMemo(() => {
    const m: Record<string, number> = {};
    m.colleges = Math.max(0, ...schools.map((s) => s.detail?.colleges?.length ?? 0));
    for (const key of ALL_CATEGORIES) {
      m[key] = Math.max(0, ...schools.map((s) => getCategoryCount(s, key)));
    }
    return m;
  }, [schools]);

  const showScrollHint = schools.length > 2;

  /** 点击校名切换展开/收起 */
  const toggleExpand = (name: string) => {
    setExpandedName((prev) => (prev === name ? null : name));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-neutral-950/80 backdrop-blur-sm"
      onClick={(e) => {
        // 只有点击背景遮罩才关闭，不拦截内容区事件
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-6 py-4 bg-neutral-900/90">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">
            学校对比
          </h2>
          <p className="mt-0.5 text-xs text-white/55">
            {schools.length} 所学校 · 同一行数值最高者高亮 · 点击校名查看详情
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showScrollHint && (
            <span className="hidden sm:block text-[11px] text-white/40">
              ← 左右滑动 →
            </span>
          )}
          <Button
            theme="dark"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            关闭
          </Button>
        </div>
      </header>

      {/* ── Cards ── */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto p-5">
        <div className="mx-auto flex w-max gap-4 pb-4">
          {schools.map((school, index) => {
            const collegeCount = school.detail?.colleges?.length ?? 0;
            const isExpanded = expandedName === school.name;

            return (
              <motion.div
                key={`${school.name || school.url || "school"}-${index}`}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`group relative flex w-[320px] shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-100 shadow-2xl shadow-black/20 transition-all duration-200 ${
                  isExpanded
                    ? "h-auto min-h-[480px]"
                    : "h-auto max-h-[calc(100vh-120px)]"
                }`}
              >
                {/* 卡片头部 */}
                <div className="border-b border-white/10 bg-neutral-200/60 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(school.name)}
                      className="flex min-w-0 items-center gap-1.5 text-left hover:text-brand-400 transition"
                    >
                      <h3
                        className={`text-sm font-semibold leading-tight transition-colors ${
                          isExpanded ? "text-brand-500" : "text-text-light"
                        }`}
                      >
                        {school.name}
                      </h3>
                      <IconChevronDown
                        size={14}
                        className={`shrink-0 text-text-muted transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(school)}
                      className="shrink-0 rounded-full p-1.5 text-danger-400/70 hover:bg-danger-soft hover:text-danger-500 transition"
                      title="移除此学校"
                    >
                      <IconClose size={13} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {school.is985 && <Badge label="985" tone="red" size="sm" />}
                    {school.is211 && <Badge label="211" tone="gold" size="sm" />}
                    {school.isDoubleFirstClass && (
                      <Badge label="双一流" tone="green" size="sm" />
                    )}
                  </div>
                </div>

                {/* 卡片内容：摘要行 or 展开详情 */}
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {!isExpanded ? (
                    <>
                      {/* 收起态：关键指标摘要 */}
                      <div className="space-y-2 text-xs">
                        <CompareRow label="省份" value={school.province} />
                        {maxCounts.colleges > 0 && (
                          <CompareRow
                            label={STAT_LABELS.college}
                            value={`${collegeCount} ${STAT_LABELS.unit}`}
                            isBest={
                              collegeCount > 0 &&
                              collegeCount === maxCounts.colleges
                            }
                          />
                        )}

                        <div className="h-px bg-black/5" />

                        {ALL_CATEGORIES
                          .filter((key) => maxCounts[key] > 0)
                          .map((key) => {
                            const count = getCategoryCount(school, key);
                            return (
                              <CompareRow
                                key={key}
                                label={CATEGORY_LABELS[key]}
                                value={`${count} 条`}
                                isBest={
                                  count > 0 && count === maxCounts[key]
                                }
                              />
                            );
                          })}
                      </div>

                      {/* 底部官网链接（收起态） */}
                      {school.url && (
                        <div className="border-t border-white/10 pt-2 mt-2">
                          <a
                            href={school.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-[11px] text-brand-500/80 hover:text-brand-400"
                          >
                            {school.url.replace(/^https?:\/\//, "")}
                          </a>
                        </div>
                      )}
                    </>
                  ) : (
                    /* 展开态：完整详情 */
                    <ExpandedDetail school={school} />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/80 px-8 py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
            <span className="text-sm text-white/70">
              正在加载对比数据…
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
