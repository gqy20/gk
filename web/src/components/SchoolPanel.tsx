"use client";

import { useState } from "react";
import type {
  CollegeItem,
  DetailCategoryKey,
  DocItem,
  School,
  StudentExperienceItem,
  UniversityInfo,
} from "@/lib/data";
import {
  CATEGORY_LABELS,
  DETAIL_CATEGORIES,
} from "@/lib/data";

interface SchoolPanelProps {
  school: School | null;
  onClose?: () => void;
}

type TabKey = "overview" | DetailCategoryKey;

export default function SchoolPanel({ school, onClose }: SchoolPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  if (!school) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        点击学校查看详情
      </div>
    );
  }

  const detail = school.detail;
  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "概览" },
    ...DETAIL_CATEGORIES.map((k) => ({
      key: k,
      label: CATEGORY_LABELS[k],
      count: detail?.[k]?.length ?? 0,
    })),
    { key: "colleges", label: CATEGORY_LABELS.colleges, count: detail?.colleges?.length ?? 0 },
    { key: "student_experiences", label: CATEGORY_LABELS.student_experiences, count: detail?.student_experiences?.length ?? 0 },
  ];

  // 过滤出有数据的 tab
  const availableTabs = tabs.filter((t) => {
    if (t.key === "overview") return true;
    if (!detail) return false;
    const items = detail[t.key];
    if (Array.isArray(items)) return items.length > 0;
    return false;
  });

  return (
    <div className="flex flex-col h-full">
      {/* 学校头部 */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-start gap-3">
          <h2 className="text-base font-bold text-gray-800 flex-1 min-w-0">
            {school.name}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-blue-600 hover:text-blue-700 flex-shrink-0"
            >
              返回列表
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <span>{school.province}</span>
          <span>·</span>
          <a
            href={school.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline truncate max-w-[150px]"
          >
            {school.url.replace(/^https?:\/\//, "")}
          </a>
          <span className="ml-auto">
            {school.status === "done" ? (
              <span className="text-green-500 font-medium">已抓取</span>
            ) : (
              <span className="text-gray-400">待抓取</span>
            )}
          </span>
        </div>
        {/* 标签 */}
        <div className="flex gap-1.5 mt-2">
          {school.is985 && <Tag label="985" color="red" />}
          {school.is211 && <Tag label="211" color="orange" />}
          {school.isDoubleFirstClass && <Tag label="双一流" color="purple" />}
        </div>
      </div>

      {/* Tab 栏 */}
      <div className="flex overflow-x-auto border-b border-gray-200 px-2 bg-white">
        {availableTabs.map((tab) => (
          <button
            key={String(tab.key)}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-500 text-blue-600 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-px rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "overview" ? (
          <OverviewSection detail={detail} school={school} />
        ) : detail ? (
          <DetailCategory
            category={activeTab}
            detail={detail}
          />
        ) : (
          <p className="text-sm text-gray-400">暂无数据</p>
        )}
      </div>
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  const c: Record<string, string> = {
    red: "bg-red-50 text-red-500 border-red-200",
    orange: "bg-orange-50 text-orange-500 border-orange-200",
    purple: "bg-purple-50 text-purple-500 border-purple-200",
  };
  return (
    <span className={`text-[10px] px-1.5 py-px rounded border ${c[color] || ""}`}>
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
      <div className="text-sm text-gray-400 space-y-2">
        <p>该高校详情数据尚未抓取完成。</p>
        <p className="text-xs">状态：{school.status === "done" ? "已完成" : "等待中..."}</p>
      </div>
    );
  }

  const filledCategories = DETAIL_CATEGORIES.filter(
    (k) => detail[k] && detail[k]!.length > 0,
  );
  const missingCount = detail.missing_categories?.length ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">
          抓取概况
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <InfoRow label="抓取时间" value={detail.crawl_time?.slice(0, 16) || "-"} />
          <InfoRow
            label="信息完整度"
            value={`${filledCategories.length}/${DETAIL_CATEGORIES.length} 类`}
          />
          {missingCount > 0 && (
            <InfoRow
              label="缺失类别"
              value={`${missingCount} 类`}
              warn
            />
          )}
          {detail.notes && (
            <div className="col-span-2 text-xs text-gray-500 bg-yellow-50 p-2 rounded">
              备注：{detail.notes}
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">
          已获取信息 ({filledCategories.length} 类)
        </h3>
        <div className="space-y-1.5">
          {filledCategories.map((k) => {
            const items = detail[k]!;
            return (
              <div key={k} className="text-xs">
                <span className="font-medium text-gray-700">
                  {CATEGORY_LABELS[k]}
                </span>
                <span className="text-gray-400 ml-1">({items.length} 条)</span>
                <div className="mt-1 pl-2 space-y-1">
                  {items.slice(0, 3).map((item, i) => (
                    <DocItemMini key={i} item={item as DocItem} />
                  ))}
                  {items.length > 3 && (
                    <p className="text-gray-400 pl-2">
                      ...还有 {items.length - 3} 条
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {detail.colleges && detail.colleges.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">
            学院列表 ({detail.colleges.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {detail.colleges.slice(0, 15).map((c) => (
              <span
                key={c.name}
                className="text-[11px] px-2 py-1 bg-gray-50 rounded text-gray-600"
              >
                {c.name}
              </span>
            ))}
            {detail.colleges.length > 15 && (
              <span className="text-[11px] px-2 py-1 text-gray-400">
                +{detail.colleges.length - 15}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
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
    <div className={`text-xs ${warn ? "text-orange-600" : "text-gray-600"}`}>
      <span className="text-gray-400">{label}：</span>
      {value}
    </div>
  );
}

function DocItemMini({ item }: { item: DocItem }) {
  return (
    <div className="pl-2 border-l-2 border-blue-100 hover:border-blue-300 transition-colors">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline text-xs line-clamp-1"
      >
        {item.title}
      </a>
      {item.summary && (
        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">
          {item.summary}
        </p>
      )}
      {item.attachments?.length > 0 && (
        <span className="inline-block mt-0.5 text-[10px] bg-red-50 text-red-400 px-1 rounded">
          📎 {item.attachments.length}
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
    return <p className="text-sm text-gray-400">暂无数据</p>;
  }

  if (category === "colleges") {
    const colleges = items as CollegeItem[];
    return (
      <div className="space-y-2">
        {colleges.map((c) => (
          <div key={c.name} className="text-xs p-2 bg-gray-50 rounded">
            <span className="font-medium text-gray-700">{c.name}</span>
            {c.disciplines?.length > 0 && (
              <span className="ml-2 text-gray-400">
                ({c.disciplines.join("、")})
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (category === "student_experiences") {
    const exps = items as StudentExperienceItem[];
    return (
      <div className="space-y-3">
        {exps.map((e, i) => (
          <div key={i} className="text-xs p-2 bg-yellow-50 rounded border border-yellow-100">
            <div className="font-medium text-yellow-700">{e.topic}</div>
            <p className="mt-1 text-gray-600">{e.content}</p>
            <span className="text-[10px] text-yellow-500">
              来源：{e.source_type}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // 普通 DocItem 列表
  const docs = items as DocItem[];
  return (
    <div className="space-y-3">
      {docs.map((item, i) => (
        <div key={i} className="text-xs p-2.5 bg-white rounded border border-gray-100 hover:border-blue-200 transition-colors">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 hover:underline block"
          >
            {item.title}
          </a>
          {item.publish_date && (
            <span className="ml-2 text-gray-400">{item.publish_date}</span>
          )}
          {item.source_department && (
            <span className="block text-[10px] text-gray-400 mt-0.5">
              来源：{item.source_department}
            </span>
          )}
          {item.summary && (
            <p className="mt-1 text-gray-600 leading-relaxed">{item.summary}</p>
          )}
          {item.attachments?.length > 0 && (
            <div className="mt-1.5 flex gap-1.5 flex-wrap">
              {item.attachments.map((att, j) => (
                <a
                  key={j}
                  href={att}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100 inline-flex items-center gap-1"
                >
                  📎 附件{j + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
