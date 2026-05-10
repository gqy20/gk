"use client";

import { useState, useEffect, useLayoutEffect, useRef, forwardRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { DocItem, School, UniversityInfo, MajorSatisfaction } from "@/lib/data";
import { DETAIL_CATEGORIES, CATEGORY_LABELS } from "@/lib/data";
import {
  CRAWL_CATEGORIES,
  CRAWL_CATEGORY_LABELS,
  type CategoryStatus,
  type CrawlStatusMap,
  type SourceItem,
  type CrawlSourcesMap,
} from "@/lib/crawl-data";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  ZHIHU_HIGH: "知乎精选",
  ZHIHU_NORMAL: "知乎",
  OFFICIAL_EDU: "官网",
  NEWS: "新闻",
  GAOKAO_GOV: "高考网",
  XIAOHONGSHU: "小红书",
  BILIBILI: "B站",
  TIEBA: "贴吧",
  DOUYIN: "抖音",
  OTHER: "其他",
};

interface OverviewSectionProps {
  detail?: UniversityInfo;
  school: School;
  crawlStatus?: CrawlStatusMap | null;
  crawlSources?: CrawlSourcesMap | null;
  activeCrawlCategory?: string | null;
  onCategoryClick?: (category: string) => void;
}

export default function OverviewSection({
  detail,
  school,
  crawlStatus,
  crawlSources,
  activeCrawlCategory,
  onCategoryClick,
}: OverviewSectionProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement>>({});
  const popoverRef = useRef<HTMLDivElement>(null);

  if (!detail) {
    return (
      <div className="space-y-4">
        {/* 阳光高考基础信息（即使无 detail 也可能显示） */}
        {school.detail?.basic_info && (
          <BasicInfoCard bi={school.detail.basic_info} />
        )}
        <div className="rounded-lg border border-border-light bg-ink-50 p-4 text-sm text-dark-600">
          <div className="font-semibold text-text-light">详情数据未完成</div>
          <div className="mt-2 text-xs">
            当前状态：{school.status === "done" ? "已完成" : "等待采集"}
          </div>
        </div>
      </div>
    );
  }

  const filledCategories = DETAIL_CATEGORIES.filter(
    (key) => detail[key] && detail[key]!.length > 0,
  );

  const statusMap = crawlStatus?.[school.name];
  const crawlDoneCount = statusMap
    ? CRAWL_CATEGORIES.filter((c) => statusMap[c]?.status === "done").length
    : 0;

  const schoolSources = crawlSources?.[school.name];

  // 同步外部点击（Header 进度条）与本地展开状态
  useEffect(() => {
    if (activeCrawlCategory && activeCrawlCategory !== expandedCard) {
      setExpandedCard(activeCrawlCategory);
    }
  }, [activeCrawlCategory]);

  // 点击外部关闭浮层
  useEffect(() => {
    if (!expandedCard) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        (expandedCard && cardRefs.current[expandedCard]?.contains(target))
      )
        return;
      setExpandedCard(null);
      if (expandedCard) onCategoryClick?.(expandedCard);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [expandedCard]);

  function toggleCard(cat: string) {
    setExpandedCard((prev) => (prev === cat ? null : cat));
    onCategoryClick?.(cat);
  }

  return (
    <div className="space-y-4">
      {/* 阳光高考基础信息（始终显示，有数据时） */}
      {detail.basic_info && <BasicInfoCard bi={detail.basic_info} />}

      {/* 专业满意度（来自阳光高考 major_streaming） */}
      {detail.major_satisfaction && detail.major_satisfaction.length > 0 && (
        <MajorSatisfactionCard items={detail.major_satisfaction} />
      )}

      {/* 校园信息采集进度 */}
      {statusMap && (
        <section className="relative">
          <SectionTitle
            label={`校园信息采集 (${crawlDoneCount}/${CRAWL_CATEGORIES.length})`}
          />
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CRAWL_CATEGORIES.map((cat) => {
              const cs = statusMap[cat] as CategoryStatus | undefined;
              const info = CRAWL_CATEGORY_LABELS[cat];
              if (!cs) return null;
              const isDone = cs.status === "done";
              const isFailed = cs.status === "failed";
              const isActive = activeCrawlCategory === cat || expandedCard === cat;

              return (
                <button
                  key={cat}
                  ref={(el) => { if (el) cardRefs.current[cat] = el; }}
                  type="button"
                  onClick={() => toggleCard(cat)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-all duration-200 cursor-pointer shadow-sm",
                    isActive
                      ? "border-green-400 bg-green-50/70 shadow-lg shadow-green-500/20 ring-1 ring-green-400/25"
                      : isDone
                        ? "border-l-2 border-l-green-400 bg-green-50/40 hover:shadow-md hover:-translate-y-px hover:border-green-300/60"
                        : isFailed
                          ? "border-l-2 border-l-red-400 bg-red-50/30 hover:shadow-md hover:-translate-y-px hover:border-red-300/60"
                          : "border-l-2 border-l-dashed border-dark-300 bg-ink-50 hover:shadow-md hover:-translate-y-px hover:border-dark-500/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-text-light">
                      {info.icon} {info.label}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        isDone
                          ? "bg-green-100 text-green-600"
                          : isFailed
                            ? "bg-red-100 text-red-500"
                            : "bg-ink-700 text-dark-900",
                      )}
                    >
                      {isDone
                        ? `${cs.urls_collected} 条`
                        : cs.status === "pending"
                          ? "待采集"
                          : cs.status === "failed"
                            ? "失败"
                            : "采集中"}
                    </span>
                  </div>

                  {!isDone && cs.last_error && isActive && (
                    <p className="mt-1.5 text-[9px] text-red-400 line-clamp-2">
                      错误: {cs.last_error}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* 悬浮来源浮层 */}
          {expandedCard && schoolSources?.[expandedCard] && (
            <SourcePopover
              ref={popoverRef}
              category={expandedCard}
              label={CRAWL_CATEGORY_LABELS[expandedCard]}
              sources={schoolSources[expandedCard]}
              anchorEl={cardRefs.current[expandedCard]}
              onClose={() => { setExpandedCard(null); if (expandedCard) onCategoryClick?.(expandedCard); }}
            />
          )}
        </section>
      )}

      <section>
        <SectionTitle label={`已获取信息 ${filledCategories.length} 类`} />
        <div className="mt-2 space-y-2">
          {filledCategories.map((key) => {
            const items = detail[key]!;
            return (
              <div key={key} className="rounded-lg border border-border-light bg-ink-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-text-light">
                    {CATEGORY_LABELS[key]}
                  </span>
                  <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-dark-900">
                    {items.length} 条
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {items.slice(0, 3).map((item, index) => (
                    <DocItemMini key={index} item={item as DocItem} />
                  ))}
                  {items.length > 3 && (
                    <p className="text-xs text-dark-600">
                      还有 {items.length - 3} 条
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {detail.colleges && detail.colleges.length > 0 && (
        <section>
          <SectionTitle label={`学院列表 ${detail.colleges.length}`} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {detail.colleges.slice(0, 18).map((college) => (
              <span
                key={college.name}
                className="rounded-full border border-border-light bg-ink-50 px-2.5 py-1 text-[11px] text-dark-950"
              >
                {college.name}
              </span>
            ))}
            {detail.colleges.length > 18 && (
              <span className="px-2.5 py-1 text-[11px] text-dark-600">
                +{detail.colleges.length - 18}
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <h3 className="text-[10px] font-semibold text-dark-800">{label}</h3>
  );
}

function DocItemMini({ item }: { item: DocItem }) {
  return (
    <div className="border-l-2 border-primary-border pl-2 transition hover:border-green-400">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="line-clamp-1 text-xs font-medium text-green-800 hover:text-green-700"
      >
        {item.title}
      </a>
      {item.summary && (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-dark-600">
          {item.summary}
        </p>
      )}
      {item.attachments?.length > 0 && (
        <span className="mt-1 inline-block rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-400">
          附件 {item.attachments.length}
        </span>
      )}
    </div>
  );
}

/** 阳光高考基础信息卡片 */
function BasicInfoCard({ bi }: { bi: NonNullable<UniversityInfo["basic_info"]> }) {
  return (
    <section>
      <SectionTitle label="基础信息" />
      <div className="mt-2 rounded-lg border border-blue-200/60 bg-blue-50/40 p-3 text-xs space-y-2">
        {bi.address && (
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-blue-600">📍</span>
            <span className="text-dark-900">{bi.address}</span>
          </div>
        )}
        {bi.phone && (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-blue-600">📞</span>
            <span>{bi.phone}</span>
          </div>
        )}
        {bi.enrollment_website && (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-blue-600">📋</span>
            <a
              href={bi.enrollment_website.startsWith("http") ? bi.enrollment_website : `https://${bi.enrollment_website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-blue-700 hover:text-blue-600 transition"
            >
              {bi.enrollment_website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

/** 专业满意度卡片（来自阳光高考学生评分） */
function MajorSatisfactionCard({ items }: { items: MajorSatisfaction[] }) {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 8);
  const avg = (items.reduce((s, i) => s + i.score, 0) / items.length).toFixed(1);

  const scoreColor = (score: number) => {
    if (score >= 4.5) return "bg-green-400";
    if (score >= 4.0) return "bg-yellow-400";
    if (score >= 3.5) return "bg-orange-400";
    return "bg-red-300";
  };

  return (
    <section>
      <SectionTitle label={`专业满意度 (${items.length})`} />
      <div className="mt-2 rounded-lg border border-orange-200/60 bg-orange-50/30 p-3 text-xs space-y-2">
        {/* 平均分 */}
        <div className="flex items-center justify-between">
          <span className="text-dark-600">平均满意度</span>
          <span className="text-base font-bold text-orange-600">{avg}</span>
        </div>

        {/* Top 专业列表 */}
        <div className="space-y-1.5">
          {top.map((item, idx) => (
            <div key={item.title} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-[10px] font-semibold text-orange-500/70">
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-dark-900">
                {item.title}
              </span>
              <div className="flex items-center gap-1.5">
                {/* 评分条 */}
                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-black/5">
                  <div
                    className={`h-full rounded-full transition-all ${scoreColor(item.score)}`}
                    style={{ width: `${(item.score / 5) * 100}%` }}
                  />
                </div>
                <span className="w-7 text-right text-[11px] font-semibold tabular-nums text-orange-700">
                  {item.score.toFixed(1)}
                </span>
                <span className="w-8 text-right text-[9px] text-dark-400">
                  ({item.votes}人)
                </span>
              </div>
            </div>
          ))}
        </div>

        {items.length > 8 && (
          <p className="text-center text-[10px] text-dark-400">
            还有 {items.length - 8} 个专业
          </p>
        )}
      </div>
    </section>
  );
}

const SourcePopover = forwardRef<
  HTMLDivElement,
  {
    category: string;
    label: { icon: string; label: string };
    sources: SourceItem[];
    anchorEl?: HTMLButtonElement;
    onClose: () => void;
  }
>(function SourcePopover({ label, sources, anchorEl, onClose }, ref) {
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);

  // 入场动画：先渲染透明 → 下一帧触发 transition
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useLayoutEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();

    // 默认在触发卡片下方弹出，空间不够则翻转到上方
    const belowSpace = window.innerHeight - rect.bottom - 8;
    const popoverHeight = Math.min(sources.length * 52 + 60, 320);
    const top = belowSpace >= popoverHeight || rect.top < popoverHeight + 8
      ? rect.bottom + 6
      : rect.top - popoverHeight - 6;

    // 水平居中，不超出视口
    const left = Math.max(8, Math.min(rect.left + (rect.width - 300) / 2, window.innerWidth - 308));
    setPos({ top, left });

    function onResize() {
      if (!anchorEl) return;
      const r = anchorEl.getBoundingClientRect();
      const bs = window.innerHeight - r.bottom - 8;
      const ph = Math.min(sources.length * 52 + 60, 320);
      const t = bs >= ph || r.top < ph + 8 ? r.bottom + 6 : r.top - ph - 6;
      const l = Math.max(8, Math.min(r.left + (r.width - 300) / 2, window.innerWidth - 308));
      setPos({ top: t, left: l });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [anchorEl, sources.length]);

  return createPortal(
    <div
      ref={ref}
      className={cn(
        "fixed z-[9999] w-[300px] rounded-xl border border-green-300/40 bg-surface-light/95 p-3 shadow-xl shadow-black/25 backdrop-blur-sm transition-[opacity,transform] duration-200 ease-out",
        visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
      )}
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="flex items-center justify-between border-b border-border-subtle pb-2 mb-2">
        <span className="text-xs font-semibold text-text-light">
          {label.icon} {label.label} · {sources.length} 条来源
        </span>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            setTimeout(onClose, 200);
          }}
          className="rounded p-0.5 text-dark-500 transition hover:bg-ink-100 hover:text-dark-800"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
        {sources.map((src, i) => (
          <a
            key={i}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-border-subtle/60 bg-white/[0.03] p-2 text-[11px] leading-relaxed transition hover:bg-white/[0.07] hover:border-blue-400/40"
          >
            <div className="line-clamp-1 font-medium text-blue-700">
              {src.title || new URL(src.url).hostname.replace("www.", "")}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[9px] text-dark-500">
              <span className="rounded-full border border-border-subtle bg-ink-50 px-1 py-px">
                {SOURCE_TYPE_LABELS[src.source_type] || src.source_type}
              </span>
              <span>置信度 {Math.round(src.agent_confidence * 100)}%</span>
              {src.http_status && src.http_status >= 404 && src.http_status !== 403 && src.http_status !== 401 && (
                <span className="rounded bg-red-50 px-1 py-px text-red-400">
                  HTTP {src.http_status}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>,
    document.body,
  );
});
