"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select as SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Slider } from "@/components/ui/Slider";
import { TextField } from "@/components/ui/Field";
import { IconHistory } from "@/components/ui/Icon";
import { createFutureRunFromClient, fetchFutureRunsFromClient } from "@/lib/future/client";
import type { FutureRunInput, FutureRunListItem } from "@/lib/future/types";
import type { School } from "@/lib/data";
import { fetchSchoolDetail, mergeSchoolDetail } from "@/lib/school-details";
import { PROVINCE_COORDS } from "@/lib/provinces";
import { FuturePanel, FutureShell, SectionHeading } from "./FutureShell";
import { FutureLoading } from "./FutureLoading";
import { TONE, type ToneKey } from "./_tone";
import { useGsapScrollReveal } from "@/lib/animation/useGsapScrollReveal";

function splitTags(value: string) {
  return value
    .split(/[，,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueNonEmptyOptions(options: string[]) {
  return Array.from(
    new Set(options.map((option) => option.trim()).filter(Boolean)),
  );
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
    <FutureShell title="大学四年预演" backHref="/" backLabel="返回">
      <FuturePanel className="p-5 text-sm text-text-secondary">正在加载预演表单…</FuturePanel>
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
  const [goals, setGoals] = useState("担心专业不适合，也希望大学毕业后有比较稳的选择。");
  const [targetSchool, setTargetSchool] = useState(school);
  const [targetMajor, setTargetMajor] = useState(major);
  const [targetCity, setTargetCity] = useState(city);
  const pathCount = 3;
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"form" | "history">("form");
  const [historyItems, setHistoryItems] = useState<FutureRunListItem[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const provinceOptions = useMemo(() => Object.keys(PROVINCE_COORDS), []);

  useGsapScrollReveal(scrollRootRef, [tab, historyItems?.length]);

  useEffect(() => {
    let cancelled = false;
    async function loadSchools() {
      try {
        const res = await fetch("/data/schools-index.json");
        const raw = await res.json();
        if (!cancelled) setSchools(raw.schools || []);
      } catch {
        if (!cancelled) setSchools([]);
      }
    }
    loadSchools();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab !== "history") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setHistoryLoading(true);
      setHistoryError(null);
    });
    fetchFutureRunsFromClient({ limit: 20 })
      .then((items) => {
        if (cancelled) return;
        setHistoryItems(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setHistoryError(err instanceof Error ? err.message : "拉取历史失败");
        setHistoryItems([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const selectedSchool = useMemo(
    () => schools.find((item) => item.name === targetSchool) || null,
    [schools, targetSchool],
  );

  useEffect(() => {
    if (!selectedSchool || selectedSchool.detail) return;
    let cancelled = false;

    fetchSchoolDetail(selectedSchool.name)
      .then((detailSchool) => {
        if (cancelled || !detailSchool) return;
        setSchools((current) => mergeSchoolDetail(current, detailSchool));
      })
      .catch(() => {
        // 详情只用于城市和专业候选，失败不阻断表单填写。
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSchool]);

  const cityOptions = useMemo(() => {
    const values = schools.map((item) => extractCity(item)).filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }, [schools]);
  const majorOptions = useMemo(() => {
    const values = [
      ...(selectedSchool?.detail?.major_satisfaction || []).map((item) => item.title),
      ...(selectedSchool?.detail?.colleges || []).flatMap((college) => college.disciplines || []),
    ];
    return Array.from(new Set(values.filter(Boolean))).slice(0, 80);
  }, [selectedSchool]);

  useEffect(() => {
    if (!selectedSchool) return;
    const nextCity = extractCity(selectedSchool);
    if (!nextCity || targetCity) return;
    queueMicrotask(() => setTargetCity(nextCity));
  }, [selectedSchool, targetCity]);

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
      setError(err instanceof Error ? err.message : "预演服务调用失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FutureShell
      title="大学四年预演"
      subtitle="把一个志愿拆成几种大学走法：稳住成绩、早点实习、试错探索，或提前准备转向预案。"
      backHref="/"
      backLabel="返回"
      headerControls={<TabBar value={tab} onChange={setTab} />}
      headerMaxClassName="max-w-none"
      contentMaxClassName="max-w-none"
      mainClassName="pb-10 pt-5"
    >
      {tab === "form" && (
      <div ref={scrollRootRef} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div data-scroll-reveal>
            <FuturePanel className="p-5 sm:p-6">
              <FormStep number="01" title="你正在考虑的志愿" description="先填这次想预演的学校、专业和城市。">
                <div className="grid gap-x-5 gap-y-4 lg:grid-cols-3">
                  <OptionSelect
                    label="目标学校"
                    value={targetSchool}
                    onChange={(value) => {
                      setTargetSchool(value);
                      const school = schools.find((item) => item.name === value);
                      const nextCity = school ? extractCity(school) : "";
                      if (nextCity) setTargetCity(nextCity);
                    }}
                    options={schools.map((item) => item.name)}
                    required
                  />
                  <OptionSelect
                    label="目标专业"
                    value={targetMajor}
                    onChange={setTargetMajor}
                    options={majorOptions}
                    placeholder={selectedSchool ? "选择专业/学科方向" : "先选择学校"}
                  />
                  <OptionSelect
                    label="目标城市"
                    value={targetCity}
                    onChange={setTargetCity}
                    options={cityOptions}
                  />
                </div>
              </FormStep>
            </FuturePanel>
          </div>

          <div data-scroll-reveal>
            <FuturePanel className="p-5 sm:p-6">
              <FormStep number="02" title="你的情况" description="不用写得很完美，重点是让几条大学路线更贴近你。">
                <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                  <Select label="生源省份" value={studentProvince} onChange={setStudentProvince} options={provinceOptions} placeholder="请选择生源省份" />
                  <Select label="选科/方向" value={subjectTrack} onChange={setSubjectTrack} options={["物理", "历史", "理科", "文科", "综合"]} />
                  <Select label="分数段" value={scoreBand} onChange={setScoreBand} options={["顶尖", "较高", "中上", "中等", "压线"]} />
                  <TextField
                    label="性格标签"
                    value={personalityTags}
                    onChange={(e) => setPersonalityTags(e.target.value)}
                    placeholder="用空格分隔，如：理性 好奇"
                  />
                  <TextField
                    label="兴趣方向"
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    placeholder="用空格分隔，如：计算机 工程"
                  />
                  <Select label="家庭支持" value={familySupport} onChange={setFamilySupport} options={["低", "中低", "中", "中高", "高"]} />
                </div>
              </FormStep>
            </FuturePanel>
          </div>

          <div data-scroll-reveal>
            <FuturePanel className="p-5 sm:p-6">
              <FormStep number="03" title="你最担心什么" description="这些顾虑会决定路线更偏成绩、就业、探索还是转向预案。">
                <div className="grid items-start gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
                  <div className="rounded-xl bg-neutral-0/45 p-4">
                    <Slider
                      aria-label="风险偏好"
                      min={1}
                      max={10}
                      step={1}
                      value={riskTolerance}
                      onChange={(v) => setRiskTolerance(v)}
                      minLabel="稳健"
                      midLabel="均衡"
                      maxLabel="冒险"
                    />
                  </div>
                  <Label className="space-y-3">
                    <span className="block">担心/期待</span>
                    <Textarea
                      value={goals}
                      onChange={(event) => setGoals(event.target.value)}
                      className="min-h-32 resize-y"
                    />
                  </Label>
                </div>
              </FormStep>
            </FuturePanel>
          </div>

          <div data-scroll-reveal className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface-elevated px-5 py-4 shadow-[0_10px_24px_-22px_rgba(17,24,32,0.28)]">
            <p className={`max-w-2xl text-xs leading-5 ${targetSchool.trim() ? "text-text-secondary" : "font-medium text-warning"}`}>
              {targetSchool.trim()
                ? "默认生成 3 条大学路线：一条偏稳、一条偏实践、一条保留试错或转向空间。"
                : "请先在上方「目标学校」选择一所学校，才能开始预演。"}
            </p>
            <Button type="submit" loading={submitting} disabled={!targetSchool.trim()} theme="light" variant="primary">
              {submitting ? "生成中" : "开始预演"}
            </Button>
          </div>

          {error && (
            <p className="rounded-lg border border-danger-300/40 bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
        </form>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div data-scroll-reveal data-scroll-y="10">
            <FuturePanel className="p-5 sm:p-6">
              <SectionHeading title="本次预演摘要" description="提交前先确认要预演的是不是这次志愿。" />
              <dl className="mt-4 divide-y divide-border/70 border-y border-border/70 text-sm">
                <SummaryRow label="学校" value={targetSchool || "未填写"} />
                <SummaryRow label="专业" value={targetMajor || "未指定"} />
                <SummaryRow label="城市" value={targetCity || "未指定"} />
                <SummaryRow label="学生" value={`${studentProvince || "未指定"} · ${subjectTrack} · ${scoreBand}`} />
                <SummaryRow label="偏好" value={`${riskTolerance}/10 · ${familySupport}支持`} />
              </dl>
            </FuturePanel>
          </div>

          <div data-scroll-reveal data-scroll-y="10">
            <FuturePanel className="p-5 sm:p-6">
              <SectionHeading title="输出会包含" />
              <div className="mt-4 grid gap-2 text-xs leading-5 text-text-secondary">
                {["推荐先按哪条路线走", "几种大学四年走法", "大一大二行动清单", "最容易踩的坑", "什么时候该换路"].map((item) => (
                  <InfoRow key={item} value={item} />
                ))}
              </div>
            </FuturePanel>
          </div>
        </aside>
      </div>
      )}

      {tab === "history" && (
        <HistoryList
          items={historyItems}
          loading={historyLoading}
          error={historyError}
          onReload={() => {
            setTab("form");
            // 下一帧切回 history,触发 useEffect 重拉
            setTimeout(() => setTab("history"), 0);
          }}
        />
      )}
    </FutureShell>
  );
}

function TabBar({ value, onChange }: { value: "form" | "history"; onChange: (v: "form" | "history") => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated p-1 backdrop-blur-sm">
      {([
        { key: "form", label: "新预演" },
        { key: "history", label: "历史" },
      ] as const).map((item) => {
        const active = value === item.key;
        return (
          <Button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={active}
            variant="ghost"
            size="sm"
            active={active}
            className="h-7 rounded-full px-3.5 font-mono text-[11px] uppercase tracking-[0.18em]"
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}

function HistoryList({
  items,
  loading,
  error,
  onReload,
}: {
  items: FutureRunListItem[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
}) {
  if (loading) {
    return <FutureLoading message="正在拉取历史…" compact />;
  }

  if (error) {
    return (
      <FuturePanel className="p-5">
        <p className="text-sm text-warning">拉取历史失败：{error}</p>
        <Button
          type="button"
          onClick={onReload}
          size="sm"
          className="mt-3"
        >
          重试
        </Button>
      </FuturePanel>
    );
  }

  if (!items || items.length === 0) {
    return (
      <FuturePanel className="p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted">
          <IconHistory size={22} />
        </span>
        <p className="mt-3 text-sm font-medium text-text-secondary">还没有预演记录</p>
        <p className="mt-1 text-xs text-text-muted">完成一次预演后，历史会出现在这里</p>
      </FuturePanel>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <HistoryCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function HistoryCard({ item }: { item: FutureRunListItem }) {
  const tone: ToneKey =
    item.toneTop === "稳健" ? "steady" : item.toneTop === "冒险" ? "risky" : "balanced";
  const toneCls = TONE[tone];
  const dateLabel = formatRelative(item.createdAt);
  const subtitle = [item.school, item.major].filter(Boolean).join(" · ") || "未指定学校";
  return (
    <a
      href={`/future/result?runId=${encodeURIComponent(item.id)}`}
      className="group/card relative block overflow-hidden rounded-2xl border border-border bg-surface-elevated p-4 transition hover:-translate-y-0.5 hover:border-accent/40 sm:p-5"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-200/70 to-transparent"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.status === "generating" ? (
              <span className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                <span aria-hidden className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                生成中
              </span>
            ) : item.status === "failed" ? (
              <span className="rounded-full border border-danger-300/40 bg-danger-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-danger-300">
                失败
              </span>
            ) : (
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] ring-1 ${toneCls.bg} ${toneCls.fg} ${toneCls.ring}`}
              >
                {item.toneTop || "已生成"}
              </span>
            )}
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              {dateLabel}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-sm font-semibold tracking-tight text-text">
            {item.title || `${item.school}的大学四年预演`}
          </h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            {subtitle}
          </p>
          {item.summary && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-text-muted">
              {item.summary}
            </p>
          )}
          {item.status === "failed" && item.errorMessage && (
            <p className="mt-1.5 text-[11px] text-danger-300">{item.errorMessage}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">适合度</div>
          <div className={`text-2xl font-semibold tabular-nums ${item.fitScoreMax > 0 ? toneCls.fg : "text-text-placeholder"}`}>
            {item.fitScoreMax > 0 ? item.fitScoreMax : "--"}
          </div>
        </div>
      </div>
    </a>
  );
}

function formatRelative(iso: string) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diffSec = Math.floor((Date.now() - t) / 1000);
  if (diffSec < 60) return "刚刚";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} 天前`;
  return new Date(t).toLocaleDateString("zh-Hans-CN");
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
    <div className="grid gap-6 lg:grid-cols-[160px_minmax(0,1fr)]">
      <div>
        <div className="text-xs font-semibold text-accent">{number}</div>
        <h2 className="mt-1 text-base font-semibold text-text">{title}</h2>
        <p className="mt-2 text-xs leading-5 text-text-secondary">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 py-2.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium text-text">{value}</dd>
    </div>
  );
}

function InfoRow({ value }: { value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface-subtle/60 px-3 py-2">
      {value}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const emptyValue = "__empty";
  const normalizedOptions = uniqueNonEmptyOptions(options);
  return (
    <Label>
      <span className="block">{label}</span>
      <SelectRoot
        value={value || emptyValue}
        onValueChange={(nextValue) => onChange(nextValue === emptyValue ? "" : nextValue)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? "请选择"} />
        </SelectTrigger>
        <SelectContent>
          {placeholder && <SelectItem value={emptyValue}>{placeholder}</SelectItem>}
          {normalizedOptions.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </Label>
  );
}

function OptionSelect({
  label,
  value,
  onChange,
  options,
  required,
  placeholder = "请选择",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  placeholder?: string;
}) {
  const uniqueOptions = uniqueNonEmptyOptions(options);
  const normalizedOptions = value.trim() && !uniqueOptions.includes(value.trim())
    ? [value.trim(), ...uniqueOptions]
    : uniqueOptions;
  const emptyValue = "__empty";
  return (
    <Label>
      <span className="block">{label}</span>
      <SelectRoot
        required={required}
        value={value || emptyValue}
        onValueChange={(nextValue) => onChange(nextValue === emptyValue ? "" : nextValue)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptyValue}>{placeholder}</SelectItem>
          {normalizedOptions.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </Label>
  );
}

function extractCity(school: School) {
  const location = school.detail?.basic_info?.location || school.detail?.basic_info?.address || "";
  const directCity = location.match(/([^省自治区\s，,：:]{2,8}市)/)?.[1];
  if (directCity) return cleanCityName(directCity);
  const provinceCityMap: Record<string, string> = {
    北京: "北京",
    上海: "上海",
    天津: "天津",
    重庆: "重庆",
    香港: "香港",
    澳门: "澳门",
  };
  return provinceCityMap[school.province] || school.province;
}

function cleanCityName(value: string) {
  return value
    .trim()
    .replace(/市$/, "")
    .replace(/^(位于|在)/, "")
    .replace(/^州(?=延吉$)/, "");
}
