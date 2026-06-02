"use client";

import { FormEvent, Suspense, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createFutureRunFromClient } from "@/lib/future/client";
import type { FutureRunInput } from "@/lib/future/types";
import { FuturePanel, FutureShell, SectionHeading } from "./FutureShell";

function splitTags(value: string) {
  return value
    .split(/[，,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function FuturePage() {
  return (
    <Suspense fallback={<FuturePageShell />}>
      <FuturePageContent />
    </Suspense>
  );
}

function FuturePageShell() {
  return (
    <FutureShell title="未来路径推演" backHref="/" backLabel="返回">
      <FuturePanel className="p-5 text-sm text-[#657064]">正在加载推演表单…</FuturePanel>
    </FutureShell>
  );
}

function FuturePageContent() {
  const router = useRouter();
  const search = useSearchParams();
  const school = search.get("school") || "";
  const major = search.get("major") || "";
  const city = search.get("city") || "";
  const province = search.get("province") || "";

  const [studentProvince, setStudentProvince] = useState("");
  const [subjectTrack, setSubjectTrack] = useState("物理");
  const [scoreBand, setScoreBand] = useState("中上");
  const [personalityTags, setPersonalityTags] = useState("理性 谨慎");
  const [interests, setInterests] = useState(major || "计算机 工程");
  const [riskTolerance, setRiskTolerance] = useState(5);
  const [familySupport, setFamilySupport] = useState("中");
  const [goals, setGoals] = useState("希望找到上限和稳定性比较平衡的路径。");
  const [targetSchool, setTargetSchool] = useState(school);
  const [targetMajor, setTargetMajor] = useState(major);
  const [targetCity, setTargetCity] = useState(city);
  const [pathCount, setPathCount] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const input = useMemo<FutureRunInput>(() => ({
    profile: {
      province: studentProvince || "未指定",
      subjectTrack,
      scoreBand,
      personalityTags: splitTags(personalityTags),
      interests: splitTags(interests),
      riskTolerance,
      familySupport,
      goals,
    },
    choiceContext: {
      school: targetSchool || "未指定学校",
      major: targetMajor || undefined,
      city: targetCity || undefined,
      province: province || undefined,
      schoolTags: [],
      evidence: [],
    },
    pathCount,
  }), [
    familySupport,
    goals,
    interests,
    pathCount,
    personalityTags,
    province,
    riskTolerance,
    scoreBand,
    studentProvince,
    subjectTrack,
    targetCity,
    targetMajor,
    targetSchool,
  ]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await createFutureRunFromClient(input);
      router.push(`/future/result?runId=${encodeURIComponent(result.runId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "推演服务调用失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FutureShell
      title="未来路径推演"
      subtitle="把一个志愿选择拆成几条可比较的未来路径：先看分叉，再看代价，最后得到前两年的行动建议。"
      backHref="/"
      backLabel="返回"
      eyebrow="3 条路径 · 分叉推演 · Neon 保存"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FuturePanel className="p-5">
            <FormStep number="01" title="目标志愿" description="先确定这次要推演的学校、专业和城市。">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="目标学校" value={targetSchool} onChange={setTargetSchool} required />
                <Field label="目标专业" value={targetMajor} onChange={setTargetMajor} />
                <Field label="目标城市" value={targetCity} onChange={setTargetCity} />
              </div>
            </FormStep>
          </FuturePanel>

          <FuturePanel className="p-5">
            <FormStep number="02" title="学生画像" description="画像不需要完美，重点是让路径差异更贴近学生本人。">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="生源省份" value={studentProvince} onChange={setStudentProvince} />
                <Select label="选科/方向" value={subjectTrack} onChange={setSubjectTrack} options={["物理", "历史", "理科", "文科", "综合"]} />
                <Select label="分数段" value={scoreBand} onChange={setScoreBand} options={["顶尖", "较高", "中上", "中等", "压线"]} />
                <Field label="性格标签" value={personalityTags} onChange={setPersonalityTags} />
                <Field label="兴趣方向" value={interests} onChange={setInterests} />
                <Select label="家庭支持" value={familySupport} onChange={setFamilySupport} options={["低", "中低", "中", "中高", "高"]} />
              </div>
            </FormStep>
          </FuturePanel>

          <FuturePanel className="p-5">
            <FormStep number="03" title="目标与取舍" description="这里决定三条路径会偏稳健、均衡还是冒险。">
              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <label className="block space-y-2 text-xs font-medium text-[#657064]">
                  <span>风险偏好：{riskTolerance}/10</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={riskTolerance}
                    onChange={(event) => setRiskTolerance(Number(event.target.value))}
                    className="w-full accent-[#b99335]"
                  />
                  <div className="flex justify-between text-[11px] text-[#8c877c]">
                    <span>稳健</span>
                    <span>均衡</span>
                    <span>冒险</span>
                  </div>
                </label>
                <label className="block space-y-2 text-xs font-medium text-[#657064]">
                  <span>目标/顾虑</span>
                  <textarea
                    value={goals}
                    onChange={(event) => setGoals(event.target.value)}
                    className="min-h-28 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-[#1d241f] outline-none transition focus:border-[#b99335]"
                  />
                </label>
              </div>
            </FormStep>
          </FuturePanel>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-[#fffaf0] px-4 py-3">
            <label className="text-xs font-medium text-[#657064]">
              路径数量
              <select
                value={pathCount}
                onChange={(event) => setPathCount(Number(event.target.value))}
                className="ml-2 rounded-lg border border-black/10 bg-white px-2 py-1 text-[#1d241f]"
              >
                {[3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={submitting || !targetSchool.trim()} theme="light" variant="primary">
              {submitting ? "生成中" : "开始推演"}
            </Button>
          </div>

          {error && (
            <p className="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-xs text-red-500">
              {error}
            </p>
          )}
        </form>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <FuturePanel className="p-5">
            <SectionHeading title="本次推演摘要" description="提交前先确认输入是否符合预期。" />
            <div className="mt-4 space-y-3 text-sm">
              <SummaryRow label="学校" value={targetSchool || "未填写"} />
              <SummaryRow label="专业" value={targetMajor || "未指定"} />
              <SummaryRow label="城市" value={targetCity || "未指定"} />
              <SummaryRow label="学生" value={`${studentProvince || "未指定"} · ${subjectTrack} · ${scoreBand}`} />
              <SummaryRow label="偏好" value={`${riskTolerance}/10 · ${familySupport}支持`} />
            </div>
          </FuturePanel>

          <FuturePanel className="p-5">
            <SectionHeading title="输出会包含" />
            <div className="mt-4 grid gap-2 text-xs leading-5 text-[#657064]">
              {["推荐路径与适配分", "三条分叉计划", "路径对比表", "大学前三阶段时间线", "前两年行动清单", "假设和质量检查"].map((item) => (
                <div key={item} className="rounded-lg border border-black/10 bg-[#f7f1e4] px-3 py-2">
                  {item}
                </div>
              ))}
            </div>
          </FuturePanel>
        </aside>
      </div>
    </FutureShell>
  );
}

function FormStep({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[150px_minmax(0,1fr)]">
      <div>
        <div className="text-xs font-semibold text-[#b99335]">{number}</div>
        <h2 className="mt-1 text-base font-semibold text-[#172019]">{title}</h2>
        <p className="mt-2 text-xs leading-5 text-[#657064]">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-black/10 pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs text-[#7c7260]">{label}</span>
      <span className="min-w-0 truncate text-sm font-medium text-[#172019]">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-xs font-medium text-[#657064]">
      <span>{label}</span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#1d241f] outline-none transition focus:border-[#b99335]"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block space-y-1.5 text-xs font-medium text-[#657064]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-[#1d241f] outline-none transition focus:border-[#b99335]"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
