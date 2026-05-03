"use client";

import type {
  CollegeItem,
  DetailCategoryKey,
  DocItem,
  StudentExperienceItem,
  UniversityInfo,
} from "@/lib/data";

interface DetailSectionProps {
  category: DetailCategoryKey;
  detail: UniversityInfo;
}

export default function DetailSection({ category, detail }: DetailSectionProps) {
  const items = detail[category];
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-dark-600">暂无数据</p>;
  }

  if (category === "colleges") {
    const colleges = items as CollegeItem[];
    return (
      <div className="space-y-2">
        {colleges.map((college) => (
          <div key={college.name} className="rounded-lg border border-border-light bg-ink-50 p-3 text-xs">
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
      </div>
    );
  }

  if (category === "student_experiences") {
    const experiences = items as StudentExperienceItem[];
    return (
      <div className="space-y-3">
        {experiences.map((experience, index) => (
          <div key={index} className="rounded-lg border border-primary-border bg-gold-50 p-3 text-xs">
            <div className="font-semibold text-gold-800">{experience.topic}</div>
            <p className="mt-2 leading-relaxed text-dark-950">{experience.content}</p>
            <div className="mt-2 text-[10px] text-red-600">
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
        <div key={index} className="rounded-lg border border-border-light bg-ink-50 p-3 text-xs transition hover:border-green-400/45">
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
    </div>
  );
}
