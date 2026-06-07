"use client";

import type {
  CollegeItem,
  DetailCategoryKey,
  DocItem,
  StudentExperienceItem,
  UniversityInfo,
} from "@/lib/data";
import { CRAWL_CATEGORY_LABELS, type SourceItem } from "@/lib/crawl-data";
import { SOURCE_TYPE_LABELS, EMPTY_MESSAGES } from "@/lib/constants";

interface DetailSectionProps {
  category: DetailCategoryKey | "campus_sources";
  detail: UniversityInfo;
  crawlSources?: Record<string, SourceItem[]>;
}

export default function DetailSection({
  category,
  detail,
  crawlSources,
}: DetailSectionProps) {
  if (category === "campus_sources") {
    const sourceGroups = getCampusSourceGroups(crawlSources);
    if (sourceGroups.length === 0) {
      return <p className="text-sm text-text-light-muted">{EMPTY_MESSAGES.noData}</p>;
    }
    return <CampusSourceLibrary groups={sourceGroups} />;
  }

  const items = detail[category];
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-text-light-muted">{EMPTY_MESSAGES.noData}</p>;
  }

  const sources = crawlSources?.[category];

  if (category === "colleges") {
    const colleges = items as CollegeItem[];
    return (
      <div className="space-y-2">
        {colleges.map((college) => (
          <div
            key={college.name}
            className="rounded-md border border-border-light bg-neutral-0/72 p-3 text-xs"
          >
            {college.url ? (
              <a
                href={college.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-500 hover:text-brand-400"
              >
                {college.name}
              </a>
            ) : (
              <span className="font-semibold text-text-light">{college.name}</span>
            )}
            {college.disciplines?.length > 0 && (
              <div className="mt-1 text-text-light-muted">
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
            className="rounded-md border border-primary-border bg-accent-50/70 p-3 text-xs"
          >
            <div className="font-semibold text-accent-700">
              {experience.topic}
            </div>
            <p className="mt-2 leading-relaxed text-text-light">
              {experience.content}
            </p>
            <div className="mt-2 text-[10px] text-danger-600">
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
              className="rounded-md border border-brand-200/60 bg-brand-50/45 p-3 text-xs"
            >
              <div className="font-semibold text-brand-800">{item.title}</div>
              <div className="mt-2 space-y-1.5">
                {lines.map((line, li) => {
                  const isQ = line.startsWith("Q:") || line.startsWith("Q：");
                  const isA = line.startsWith("A:") || line.startsWith("A：");
                  const content = line.replace(/^[QA][:：]\s*/, "");
                  if (!content) return null;
                  return (
                    <p
                      key={li}
                      className={`leading-relaxed ${isQ ? "text-brand-700 font-medium" : isA ? "text-text-light" : "text-text-light-muted"}`}
                    >
                      {isQ ? "Q: " : isA ? "A: " : ""}
                      {content}
                    </p>
                  );
                })}
              </div>
              {item.source_department && (
                <div className="mt-1.5 text-[10px] text-brand-500">
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
          className="rounded-md border border-border-light bg-neutral-0/72 p-3 text-xs transition hover:border-brand-400/45 hover:bg-brand-50/35"
        >
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-semibold leading-relaxed text-brand-500 hover:text-brand-400"
          >
            {item.title}
          </a>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-text-light-muted">
            {item.publish_date && <span>{item.publish_date}</span>}
            {item.source_department && <span>{item.source_department}</span>}
          </div>
          {item.summary && (
            <p className="mt-2 leading-relaxed text-text-light">{item.summary}</p>
          )}
          {item.attachments?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.attachments.map((attachment, attachmentIndex) => (
                <a
                  key={attachment}
                  href={attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm border border-danger-300/50 bg-danger-soft px-2 py-0.5 text-[10px] text-danger-500 transition hover:border-danger-400/50"
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

function getCampusSourceGroups(sourceMap?: Record<string, SourceItem[]>) {
  if (!sourceMap) return [];
  return Object.entries(sourceMap).filter(
    ([key, sources]) => CRAWL_CATEGORY_LABELS[key] && sources.length > 0,
  );
}

function CampusSourceLibrary({
  groups,
}: {
  groups: Array<[string, SourceItem[]]>;
}) {
  return (
    <div className="space-y-4">
      {groups.map(([key, sources]) => {
        const meta = CRAWL_CATEGORY_LABELS[key];
        return (
          <section
            key={key}
            className="rounded-md border border-border-light bg-neutral-0/72 p-3"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-text-light">
                <span className="mr-1.5">{meta.icon}</span>
                {meta.label}
              </h3>
              <span className="rounded-sm bg-surface-light-subtle px-2 py-0.5 text-[10px] text-text-light-muted">
                {sources.length} 条
              </span>
            </div>
            <SourceList sources={sources} compact />
          </section>
        );
      })}
    </div>
  );
}

function SourceList({
  sources,
  compact = false,
}: {
  sources: SourceItem[];
  compact?: boolean;
}) {
  if (!sources.length) return null;

  return (
    <section className={compact ? "space-y-2" : "mt-4 space-y-2 border-t border-border-light pt-3"}>
      {!compact && (
        <h4 className="text-[10px] font-semibold text-text-light-secondary">
          信息来源 ({sources.length} 条)
        </h4>
      )}
      {sources.slice(0, 8).map((src, i) => (
        <div
          key={i}
          className="rounded-md border border-border-subtle bg-neutral-0/62 p-2.5 text-xs"
        >
          <a
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-1 font-medium text-brand-600 hover:text-brand-400"
          >
            {src.title || src.url}
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-text-muted">
            <span className="rounded-sm border border-border-subtle bg-neutral-0/72 px-1.5 py-px">
              {SOURCE_TYPE_LABELS[src.source_type] || src.source_type}
            </span>
            <span>置信度 {Math.round(src.agent_confidence * 100)}%</span>
            {src.http_status && src.http_status >= 404 && src.http_status !== 403 && src.http_status !== 401 && (
              <span className="text-danger-400">HTTP {src.http_status}</span>
            )}
          </div>
          {src.relevance_note && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-light-muted">
              {src.relevance_note}
            </p>
          )}
        </div>
      ))}
      {sources.length > 8 && (
        <p className="text-center text-[10px] text-text-muted">
          还有 {sources.length - 8} 条来源
        </p>
      )}
    </section>
  );
}
