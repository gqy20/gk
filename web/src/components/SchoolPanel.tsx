"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CollegeItem,
  DetailCategoryKey,
  DocItem,
  School,
  StudentExperienceItem,
  UniversityInfo,
} from "@/lib/data";
import { CATEGORY_LABELS, DETAIL_CATEGORIES } from "@/lib/data";

interface SchoolPanelProps {
  school: School | null;
  onClose?: () => void;
}

type TabKey = "overview" | DetailCategoryKey;

export default function SchoolPanel({ school, onClose }: SchoolPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
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

  if (!school) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#81786a]">
        选择学校查看详情
      </div>
    );
  }

  const detail = school.detail;
  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "概览" },
    ...DETAIL_CATEGORIES.map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      count: detail?.[key]?.length ?? 0,
    })),
    {
      key: "colleges",
      label: CATEGORY_LABELS.colleges,
      count: detail?.colleges?.length ?? 0,
    },
    {
      key: "student_experiences",
      label: CATEGORY_LABELS.student_experiences,
      count: detail?.student_experiences?.length ?? 0,
    },
  ];

  const availableTabs = tabs.filter((tab) => {
    if (tab.key === "overview") return true;
    if (!detail) return false;
    const items = detail[tab.key];
    return Array.isArray(items) && items.length > 0;
  });

  const detailTabs = availableTabs.filter((tab) => tab.key !== "overview");
  const isOverview = activeTab === "overview";
  const currentDetailTab = detailTabs.find((tab) => tab.key === activeTab);

  return (
    <div className="flex h-full flex-col bg-[#f5f0e6] text-[#181713]">
      <div className="border-b border-black/10 bg-[#11130f] px-4 py-4 text-[#fff9ec]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d8b75d]">
              School Detail
            </div>
            <h2 className="mt-2 text-xl font-semibold leading-tight">
              {school.name}
            </h2>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-[#d8caa6] transition hover:border-[#d8b75d]/60 hover:bg-[#d8b75d]/10"
            >
              返回列表
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#bdb5a4]">
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            {school.province}
          </span>
          <a
            href={school.url}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[230px] truncate rounded-full border border-[#d8b75d]/35 px-2.5 py-1 text-[#e4c87c] transition hover:border-[#d8b75d]/70 hover:text-[#ffe2a0]"
          >
            {school.url.replace(/^https?:\/\//, "")}
          </a>
          <span className="ml-auto rounded-full border border-white/10 px-2.5 py-1">
            {school.status === "done" ? "已采集" : "待采集"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {school.is985 && <Tag label="985" tone="red" />}
          {school.is211 && <Tag label="211" tone="gold" />}
          {school.isDoubleFirstClass && <Tag label="双一流" tone="green" />}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-black/10 bg-[#ede4d5] px-3 py-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab("overview");
            setMenuOpen(false);
          }}
          className={`h-8 shrink-0 rounded-full border px-3.5 text-xs font-medium transition ${
            isOverview
              ? "border-[#1a342f] bg-[#1a342f] text-[#fff9ec]"
              : "border-black/10 bg-[#f8f1e5] text-[#5c5549] hover:border-[#2c5f55]/40 hover:text-[#1a342f]"
          }`}
        >
          概览
        </button>

        {detailTabs.length > 0 && (
          <>
            <span className="h-5 w-px bg-black/10" aria-hidden="true" />
            <div ref={menuRef} className="relative min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                className={`flex h-8 w-full items-center gap-2 rounded-full border px-3 text-xs font-medium transition ${
                  !isOverview
                    ? "border-[#1a342f] bg-[#1a342f] text-[#fff9ec]"
                    : "border-black/10 bg-[#f8f1e5] text-[#5c5549] hover:border-[#2c5f55]/40 hover:text-[#1a342f]"
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {currentDetailTab ? currentDetailTab.label : `选择分类 · ${detailTabs.length} 项`}
                </span>
                {currentDetailTab && currentDetailTab.count !== undefined && currentDetailTab.count > 0 && (
                  <span className="shrink-0 opacity-70">{currentDetailTab.count}</span>
                )}
                <svg
                  className={`h-3 w-3 shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {menuOpen && (
                <ul
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-[60vh] overflow-y-auto rounded-lg border border-black/10 bg-[#fffaf0] py-1 shadow-xl shadow-black/15"
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
                            setActiveTab(tab.key);
                            setMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition ${
                            isActive
                              ? "bg-[#dfeee8] font-semibold text-[#1a342f]"
                              : "text-[#3d3a32] hover:bg-[#f0e7d4]"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                          {tab.count !== undefined && tab.count > 0 && (
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                isActive
                                  ? "bg-[#1a342f] text-[#fff9ec]"
                                  : "bg-[#e8decf] text-[#5c5549]"
                              }`}
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

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === "overview" ? (
          <OverviewSection detail={detail} school={school} />
        ) : detail ? (
          <DetailCategory category={activeTab} detail={detail} />
        ) : (
          <p className="text-sm text-[#81786a]">暂无数据</p>
        )}
      </div>
    </div>
  );
}

function Tag({ label, tone }: { label: string; tone: "red" | "gold" | "green" }) {
  const toneClass = {
    red: "border-[#e3a08b]/55 bg-[#f9ddd4] text-[#9d3b25]",
    gold: "border-[#d8b75d]/55 bg-[#f5e4bb] text-[#8a6414]",
    green: "border-[#6fc0a5]/55 bg-[#dfeee8] text-[#2c5f55]",
  }[tone];

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>
      {label}
    </span>
  );
}

function OverviewSection({
  detail,
  school,
}: {
  detail?: UniversityInfo;
  school: School;
}) {
  if (!detail) {
    return (
      <div className="rounded-lg border border-black/10 bg-[#fffaf0] p-4 text-sm text-[#81786a]">
        <div className="font-semibold text-[#181713]">详情数据未完成</div>
        <div className="mt-2 text-xs">
          当前状态：{school.status === "done" ? "已完成" : "等待采集"}
        </div>
      </div>
    );
  }

  const filledCategories = DETAIL_CATEGORIES.filter(
    (key) => detail[key] && detail[key]!.length > 0,
  );
  const missingCount = detail.missing_categories?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <InfoRow label="抓取时间" value={detail.crawl_time?.slice(0, 16) || "-"} />
        <InfoRow
          label="信息完整度"
          value={`${filledCategories.length}/${DETAIL_CATEGORIES.length} 类`}
        />
        <InfoRow label="学院" value={`${detail.colleges?.length ?? 0} 个`} />
        <InfoRow
          label="缺失类别"
          value={`${missingCount} 类`}
          warn={missingCount > 0}
        />
      </div>

      {detail.notes && (
        <div className="rounded-lg border border-[#d8b75d]/35 bg-[#fff4d7] p-3 text-xs leading-relaxed text-[#7b5a19]">
          {detail.notes}
        </div>
      )}

      <section>
        <SectionTitle label={`已获取信息 ${filledCategories.length} 类`} />
        <div className="mt-2 space-y-2">
          {filledCategories.map((key) => {
            const items = detail[key]!;
            return (
              <div key={key} className="rounded-lg border border-black/10 bg-[#fffaf0] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#181713]">
                    {CATEGORY_LABELS[key]}
                  </span>
                  <span className="rounded-full bg-[#e8decf] px-2 py-0.5 text-[10px] text-[#5c5549]">
                    {items.length} 条
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {items.slice(0, 3).map((item, index) => (
                    <DocItemMini key={index} item={item as DocItem} />
                  ))}
                  {items.length > 3 && (
                    <p className="text-xs text-[#81786a]">
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
                className="rounded-full border border-black/10 bg-[#fffaf0] px-2.5 py-1 text-[11px] text-[#4f4a40]"
              >
                {college.name}
              </span>
            ))}
            {detail.colleges.length > 18 && (
              <span className="px-2.5 py-1 text-[11px] text-[#81786a]">
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
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a6414]">
      {label}
    </h3>
  );
}

function InfoRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-[#fffaf0] p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#81786a]">
        {label}
      </div>
      <div
        className={`mt-1 truncate text-sm font-semibold ${
          warn ? "text-[#9a5a13]" : "text-[#181713]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function DocItemMini({ item }: { item: DocItem }) {
  return (
    <div className="border-l-2 border-[#d8b75d]/45 pl-2 transition hover:border-[#2c5f55]">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="line-clamp-1 text-xs font-medium text-[#245d52] hover:text-[#173f38]"
      >
        {item.title}
      </a>
      {item.summary && (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#81786a]">
          {item.summary}
        </p>
      )}
      {item.attachments?.length > 0 && (
        <span className="mt-1 inline-block rounded bg-[#f9ddd4] px-1.5 py-0.5 text-[10px] text-[#9d3b25]">
          附件 {item.attachments.length}
        </span>
      )}
    </div>
  );
}

function DetailCategory({
  category,
  detail,
}: {
  category: DetailCategoryKey;
  detail: UniversityInfo;
}) {
  const items = detail[category];
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-[#81786a]">暂无数据</p>;
  }

  if (category === "colleges") {
    const colleges = items as CollegeItem[];
    return (
      <div className="space-y-2">
        {colleges.map((college) => (
          <div key={college.name} className="rounded-lg border border-black/10 bg-[#fffaf0] p-3 text-xs">
            {college.url ? (
              <a
                href={college.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#245d52] hover:text-[#173f38]"
              >
                {college.name}
              </a>
            ) : (
              <span className="font-semibold text-[#181713]">{college.name}</span>
            )}
            {college.disciplines?.length > 0 && (
              <div className="mt-1 text-[#81786a]">
                {college.disciplines.join("、")}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (category === "student_experiences") {
    const experiences = items as StudentExperienceItem[];
    return (
      <div className="space-y-3">
        {experiences.map((experience, index) => (
          <div key={index} className="rounded-lg border border-[#d8b75d]/35 bg-[#fff4d7] p-3 text-xs">
            <div className="font-semibold text-[#7b5a19]">{experience.topic}</div>
            <p className="mt-2 leading-relaxed text-[#4f4a40]">{experience.content}</p>
            <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[#9a5a13]">
              {experience.source_type}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const docs = items as DocItem[];
  return (
    <div className="space-y-3">
      {docs.map((item, index) => (
        <div key={index} className="rounded-lg border border-black/10 bg-[#fffaf0] p-3 text-xs transition hover:border-[#2c5f55]/45">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-semibold leading-relaxed text-[#245d52] hover:text-[#173f38]"
          >
            {item.title}
          </a>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-[#81786a]">
            {item.publish_date && <span>{item.publish_date}</span>}
            {item.source_department && <span>{item.source_department}</span>}
          </div>
          {item.summary && (
            <p className="mt-2 leading-relaxed text-[#4f4a40]">{item.summary}</p>
          )}
          {item.attachments?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.attachments.map((attachment, attachmentIndex) => (
                <a
                  key={attachment}
                  href={attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-[#e3a08b]/50 bg-[#f9ddd4] px-2 py-0.5 text-[10px] text-[#9d3b25] transition hover:border-[#9d3b25]/50"
                >
                  附件 {attachmentIndex + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
