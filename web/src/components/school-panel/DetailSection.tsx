"use client";

import type {
  CollegeItem,
  DetailCategoryKey,
  DocItem,
  StudentExperienceItem,
  UniversityInfo,
} from "@/lib/data";
import type { SourceItem, CrawlSourcesMap } from "@/lib/crawl-data";

interface DetailSectionProps {
  category: DetailCategoryKey;
  detail: UniversityInfo;
  crawlSources?: Record<string, SourceItem[]>;
}

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

export default function DetailSection({
  category,
  detail,
  crawlSources,
}: DetailSectionProps) {
  const items = detail[category];
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-dark-600">暂无数据</p>;
  }

  const sources = crawlSources?.[category];

  if (category === "colleges") {
    const colleges = items as CollegeItem[];
    return (
      <div className="space-y-2">
        {colleges.map((college) => (
          <div
            key={college.name}
            className="rounded-lg border border-border-light bg-ink-50 p-3 text-xs"
          >
            {college.url ? (
              <a
                href={college.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-green-800 hover:text-green-700"
              >
                {college.name}
              </a>
            ) : (
              <span className="font-semibold text-text-light">{college.name}</span>
            )}
            {college.disciplines?.length > 0 && (
              <div className="mt-1 text-dark-600">
                {college.disciplines.join("、")}
              </div>
            )}
          </div>
        ))}
        {sources && <SourceList sources={sources} />}
      </div>
    );
  }

  if (category === "student_experiences") {
    const experiences = items as StudentExperienceItem[];
    return (
      <div className="space-y-3">
        {experiences.map((experience, index) => (
          <div
            key={index}
            className="rounded-lg border border-primary-border bg-gold-50 p-3 text-xs"
          >
            <div className="font-semibold text-gold-800">
              {experience.topic}
            </div>
            <p className="mt-2 leading-relaxed text-dark-950">
              {experience.content}
            </p>
            <div className="mt-2 text-[10px] text-red-600">
              {experience.source_type}
            </div>
          </div>
        ))}
        {sources && <SourceList sources={sources} />}
      </div>
    );
  }

  // 答考生问 — Q&A 特殊渲染（summary 中包含 Q: 和 A: 格式）
  // 注意：此块需在 const docs 之后，因复用 docs 变量

  const docs = items as DocItem[];

  if (category === "faq") {
    return (
      <div className="space-y-3">
        {docs.map((item, index) => {
          const lines = item.summary.split("\n").filter(Boolean);
          return (
            <div
              key={index}
              className="rounded-lg border border-blue-200/60 bg-blue-50/40 p-3 text-xs"
            >
              <div className="font-semibold text-blue-800">{item.title}</div>
              <div className="mt-2 space-y-1.5">
                {lines.map((line, li) => {
                  const isQ = line.startsWith("Q:") || line.startsWith("Q：");
                  const isA = line.startsWith("A:") || line.startsWith("A：");
                  const content = line.replace(/^[QA][:：]\s*/, "");
                  if (!content) return null;
                  return (
                    <p
                      key={li}
                      className={`leading-relaxed ${isQ ? "text-blue-700 font-medium" : isA ? "text-dark-900" : "text-dark-700"}`}
                    >
                      {isQ ? "Q: " : isA ? "A: " : ""}
                      {content}
                    </p>
                  );
                })}
              </div>
              {item.source_department && (
                <div className="mt-1.5 text-[10px] text-blue-500">
                  来源: {item.source_department}
                </div>
              )}
            </div>
          );
        })}
        {sources && <SourceList sources={sources} />}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {docs.map((item, index) => (
        <div
          key={index}
          className="rounded-lg border border-border-light bg-ink-50 p-3 text-xs transition hover:border-green-400/45"
        >
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-semibold leading-relaxed text-green-800 hover:text-green-700"
          >
            {item.title}
          </a>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-dark-600">
            {item.publish_date && <span>{item.publish_date}</span>}
            {item.source_department && <span>{item.source_department}</span>}
          </div>
          {item.summary && (
            <p className="mt-2 leading-relaxed text-dark-950">{item.summary}</p>
          )}
          {item.attachments?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.attachments.map((attachment, attachmentIndex) => (
                <a
                  key={attachment}
                  href={attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-red-300/50 bg-red-50 px-2 py-0.5 text-[10px] text-red-400 transition hover:border-red-400/50"
                >
                  附件 {attachmentIndex + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
      {sources && <SourceList sources={sources} />}
    </div>
  );
}

function SourceList({ sources }: { sources: SourceItem[] }) {
  if (!sources.length) return null;

  return (
    <section className="mt-4 space-y-2 border-t border-border-light pt-3">
      <h4 className="text-[10px] font-semibold text-dark-800">
        信息来源 ({sources.length} 条)
      </h4>
      {sources.slice(0, 8).map((src, i) => (
        <div
          key={i}
          className="rounded-lg border border-border-subtle bg-white/[0.03] p-2.5 text-xs"
        >
          <a
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-1 font-medium text-blue-700 hover:text-blue-600"
          >
            {src.title || src.url}
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-dark-500">
            <span className="rounded-full border border-border-subtle bg-ink-50 px-1.5 py-px">
              {SOURCE_TYPE_LABELS[src.source_type] || src.source_type}
            </span>
            <span>置信度 {Math.round(src.agent_confidence * 100)}%</span>
            {src.http_status && src.http_status >= 404 && src.http_status !== 403 && src.http_status !== 401 && (
              <span className="text-red-400">HTTP {src.http_status}</span>
            )}
          </div>
          {src.relevance_note && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-dark-600">
              {src.relevance_note}
            </p>
          )}
        </div>
      ))}
      {sources.length > 8 && (
        <p className="text-center text-[10px] text-dark-500">
          还有 {sources.length - 8} 条来源
        </p>
      )}
    </section>
  );
}
