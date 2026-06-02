"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createFutureRunFromClient } from "@/lib/future/client";
import type { FutureRunInput } from "@/lib/future/types";

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
    <div className="min-h-screen bg-surface text-text">
      <header className="border-b border-border bg-surface/95 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <a href="/" className="text-sm text-dark-300 transition hover:text-text">
            ← 返回
          </a>
          <h1 className="text-lg font-semibold text-dark-50">未来路径推演</h1>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">
        <div className="rounded-lg border border-border bg-surface-elevated/50 p-5 text-sm text-dark-300">
          正在加载推演表单…
        </div>
      </main>
    </div>
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
    <div className="min-h-screen bg-surface text-text">
      <header className="border-b border-border bg-surface/95 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <a href="/" className="text-sm text-dark-300 transition hover:text-text">
            ← 返回
          </a>
          <h1 className="text-lg font-semibold text-dark-50">未来路径推演</h1>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-surface-elevated/70 p-4">
          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="目标学校" value={targetSchool} onChange={setTargetSchool} required />
            <Field label="目标专业" value={targetMajor} onChange={setTargetMajor} />
            <Field label="目标城市" value={targetCity} onChange={setTargetCity} />
            <Field label="生源省份" value={studentProvince} onChange={setStudentProvince} />
            <Select label="选科/方向" value={subjectTrack} onChange={setSubjectTrack} options={["物理", "历史", "理科", "文科", "综合"]} />
            <Select label="分数段" value={scoreBand} onChange={setScoreBand} options={["顶尖", "较高", "中上", "中等", "压线"]} />
            <Field label="性格标签" value={personalityTags} onChange={setPersonalityTags} />
            <Field label="兴趣方向" value={interests} onChange={setInterests} />
            <Select label="家庭支持" value={familySupport} onChange={setFamilySupport} options={["低", "中低", "中", "中高", "高"]} />
            <label className="space-y-1 text-xs text-dark-300">
              <span>风险偏好：{riskTolerance}/10</span>
              <input
                type="range"
                min={1}
                max={10}
                value={riskTolerance}
                onChange={(event) => setRiskTolerance(Number(event.target.value))}
                className="w-full accent-gold-300"
              />
            </label>
          </section>

          <label className="block space-y-1 text-xs text-dark-300">
            <span>目标/顾虑</span>
            <textarea
              value={goals}
              onChange={(event) => setGoals(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-border bg-surface-active px-3 py-2 text-sm text-text outline-none focus:border-primary/60"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-xs text-dark-300">
              路径数量
              <select
                value={pathCount}
                onChange={(event) => setPathCount(Number(event.target.value))}
                className="ml-2 rounded-lg border border-border bg-surface-active px-2 py-1 text-text"
              >
                {[3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={submitting || !targetSchool.trim()}>
              {submitting ? "生成中" : "开始推演"}
            </Button>
          </div>

          {error && (
            <p className="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-xs text-red-500">
              {error}
            </p>
          )}
        </form>

        <aside className="rounded-lg border border-border bg-surface-elevated/50 p-4 text-sm text-dark-300">
          <h2 className="text-sm font-semibold text-dark-50">输出内容</h2>
          <div className="mt-3 space-y-2 text-xs leading-6">
            <p>每次会生成多条结构化路径，包含时间线、评分、风险、转折点和建议。</p>
            <p>系统会先规划不同分叉，再让 LLM 按分叉生成，减少路径重复。</p>
            <p>前端会调用同源 `/api/future-runs`，由 Vercel Function 连接 LLM 与 Neon。</p>
            <p>基础学校/专业数据仍由静态 JSON 提供，动态推演结果保存到 Neon。</p>
          </div>
        </aside>
      </main>
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
    <label className="block space-y-1 text-xs text-dark-300">
      <span>{label}</span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-border bg-surface-active px-3 text-sm text-text outline-none focus:border-primary/60"
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
    <label className="block space-y-1 text-xs text-dark-300">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-border bg-surface-active px-3 text-sm text-text outline-none focus:border-primary/60"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
