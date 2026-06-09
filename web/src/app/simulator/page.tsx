"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { createSimulatorSession } from "@/lib/future/simulator-client";
import type { School } from "@/lib/data";
import { FuturePanel, FutureShell, SectionHeading } from "../future/FutureShell";

function splitTags(value: string) {
  return value.split(/[，,\s]+/).map((item) => item.trim()).filter(Boolean);
}

export default function SimulatorPage() {
  return (
    <Suspense fallback={<SimulatorShell />}>
      <SimulatorPageContent />
    </Suspense>
  );
}

function SimulatorShell() {
  return (
    <FutureShell title="大学人生模拟器" backHref="/" backLabel="返回">
      <FuturePanel className="p-5 text-sm text-text-secondary">正在加载…</FuturePanel>
    </FutureShell>
  );
}

function SimulatorPageContent() {
  const router = useRouter();
  const [targetSchool, setTargetSchool] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [targetMajor, setTargetMajor] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "unspecified">("unspecified");
  const [personalityTags, setPersonalityTags] = useState("理性 好奇");
  const [interests, setInterests] = useState("计算机 社交 阅读");
  const [riskTolerance, setRiskTolerance] = useState(5);
  const [totalRounds, setTotalRounds] = useState<3 | 8 | 20 | 50>(8);
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 加载学校列表
  useMemo(() => {
    fetch("/data/schools.json")
      .then((res) => res.json())
      .then((data) => setSchools(data.schools || []))
      .catch(() => setSchools([]));
  }, []);

  const majorOptions = useMemo(() => {
    const school = schools.find((s) => s.name === targetSchool);
    if (!school) return ["计算机", "经济学", "法学", "文学", "工学", "理学", "医学", "管理学", "艺术学"];
    return Array.from(new Set([
      ...(school.detail?.major_satisfaction || []).map((m: { title: string }) => m.title),
      ...(school.detail?.colleges || []).flatMap((c: { disciplines?: string[] }) => c.disciplines || []),
    ].filter(Boolean))).slice(0, 60);
  }, [schools, targetSchool]);

  // 从选中学校推导上下文信息
  const selectedSchoolData = useMemo(
    () => schools.find((s) => s.name === targetSchool) || null,
    [schools, targetSchool],
  );
  const schoolContext = useMemo(() => {
    if (!selectedSchoolData) return {};
    const tiers: string[] = [];
    if (selectedSchoolData.is985) tiers.push("985");
    if (selectedSchoolData.is211 && !tiers.includes("211")) tiers.push("211");
    if (selectedSchoolData.isDoubleFirstClass && !tiers.includes("双一流")) tiers.push("双一流");
    // 从学院推断学校类型
    const colleges = selectedSchoolData.detail?.colleges || [];
    const collegeNames = colleges.map((c: { name?: string }) => c.name).filter((n): n is string => Boolean(n));
    let inferredType = "综合";
    if (collegeNames.some((n) => /师范|教育|教师/.test(n))) inferredType = "师范";
    else if (collegeNames.some((n) => /医学|药|护理/.test(n))) inferredType = "医科";
    else if (collegeNames.some((n) => /财经|经济|金融|会计/.test(n))) inferredType = "财经";
    else if (collegeNames.some((n) => /理工|工学|计算机/.test(n)) && !collegeNames.some((n) => /文|法|哲|史/.test(n))) inferredType = "理工";
    return {
      province: selectedSchoolData.province,
      cityTier: ["北京", "上海", "广州", "深圳"].includes(targetCity || "") ? "一线城市"
        : ["成都", "杭州", "南京", "武汉", "西安", "重庆", "天津", "苏州"].includes(targetCity || "") ? "新一线/强二线"
        : "其他城市",
      schoolTier: tiers.length > 0 ? tiers.join("+") : undefined,
      schoolType: inferredType,
    };
  }, [selectedSchoolData, targetCity]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const session = await createSimulatorSession({
        profile: {
          school: targetSchool || "一所双一流大学",
          major: targetMajor || undefined,
          gender,
          province: schoolContext.province,
          city: targetCity || undefined,
          schoolTier: schoolContext.schoolTier,
          schoolType: schoolContext.schoolType,
          personalityTags: splitTags(personalityTags),
          interests: splitTags(interests),
          riskTolerance,
        },
        totalRounds,
      });
      router.push(`/simulator/play?sessionId=${encodeURIComponent(session.sessionId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建游戏失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FutureShell
      title="大学人生模拟器"
      backHref="/"
      backLabel="返回"
      mainClassName="pb-10 pt-5"
      contentMaxClassName="max-w-[1600px]"
    >
      <div className="mx-auto">
        <form onSubmit={handleSubmit} className="grid items-start gap-6 xl:grid-cols-[260px_minmax(0,1fr)_380px]">
          <FuturePanel as="aside" className="space-y-4 p-5 xl:sticky xl:top-20">
            <p className="max-w-[24rem] text-sm leading-7 text-text-secondary">
              每一步都是你的选择。{totalRounds} 轮决策，看看你会走出怎样的大学生活。
            </p>
            <div className="divide-y divide-border/70 border-t border-border/70">
              <div className="flex items-baseline justify-between gap-4 py-3">
                <span className="text-[11px] leading-4 text-text-muted">轮决策</span>
                <span className="font-mono text-lg font-semibold text-text">{totalRounds}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3">
                <span className="text-[11px] leading-4 text-text-muted">每轮选择</span>
                <span className="font-mono text-lg font-semibold text-text">3</span>
              </div>
            </div>
          </FuturePanel>

          <div className="space-y-5">
            <FuturePanel className="p-5 sm:p-6">
              <SectionHeading title="你的大学设定" description="选择你想模拟的学校和专业，这会影响场景内容。" />
              <div className="mt-4 grid gap-x-5 gap-y-4 md:grid-cols-2">
                <label className="block space-y-2 text-xs font-medium text-text-secondary">
                  <span>目标学校</span>
                  <span className="relative block">
                    <select
                      value={targetSchool}
                      onChange={(e) => {
                        const name = e.target.value;
                        setTargetSchool(name);
                        // 自动填充学校所在城市
                        const found = schools.find((s) => s.name === name);
                        setTargetCity(found?.province || "");
                      }}
                      className={selectClassName()}
                    >
                      <option value="">选择学校（或保持默认）</option>
                      {schools.map((s) => (
                        <option key={s.name} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </span>
                </label>

                <label className="block space-y-2 text-xs font-medium text-text-secondary">
                  <span>专业方向</span>
                  <span className="relative block">
                    <select
                      value={targetMajor}
                      onChange={(e) => setTargetMajor(e.target.value)}
                      className={selectClassName()}
                    >
                      <option value="">选择专业（可选）</option>
                      {majorOptions.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </span>
                </label>

                <label className="block space-y-2 text-xs font-medium text-text-secondary md:col-span-2">
                  <span>性别设定</span>
                  <span className="relative block">
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as "male" | "female" | "unspecified")}
                      className={selectClassName()}
                    >
                      <option value="unspecified">不指定，宿舍场景避免性别化描写</option>
                      <option value="male">男生</option>
                      <option value="female">女生</option>
                    </select>
                  </span>
                </label>
              </div>
            </FuturePanel>

            <FuturePanel className="p-5 sm:p-6">
              <SectionHeading title="你的性格" description="这些标签会让场景和选项更贴合你。" />
              <div className="mt-4 grid gap-x-5 gap-y-4 md:grid-cols-2">
                <label className="block space-y-2 text-xs font-medium text-text-secondary">
                  <span>性格标签</span>
                  <input
                    value={personalityTags}
                    onChange={(e) => setPersonalityTags(e.target.value)}
                    placeholder="用空格分隔，如：理性 好奇 内向"
                    className={inputClassName()}
                  />
                </label>
                <label className="block space-y-2 text-xs font-medium text-text-secondary">
                  <span>兴趣方向</span>
                  <input
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    placeholder="用空格分隔，如：计算机 社交 运动"
                    className={inputClassName()}
                  />
                </label>
              </div>

              <div className="mt-4 rounded-xl bg-neutral-0/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-text-secondary">冒险倾向</span>
                  <span className="font-mono text-sm font-semibold text-text">{riskTolerance}/10</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={riskTolerance}
                  onChange={(e) => setRiskTolerance(Number(e.target.value))}
                  className="simulator-risk-slider mt-3 w-full"
                />
                <div className="mt-2 flex justify-between text-[11px] text-text-muted">
                  <span>稳健谨慎</span>
                  <span>均衡</span>
                  <span>冒险探索</span>
                </div>
              </div>
            </FuturePanel>
          </div>

          {/* ── 轮数选择 ── */}
          <FuturePanel className="p-5 sm:p-6 xl:sticky xl:top-20">
            <SectionHeading title="模拟轮数" description="选择你想体验的决策深度。轮数越多，故事越丰富。" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-1">
              {([
                { value: 3 as const, label: "3 轮", desc: "快速体验", detail: "入学→适应→起步，约 2 分钟" },
                { value: 8 as const, label: "8 轮", desc: "标准模式 ⭐", detail: "完整四年脉络：入学到毕业" },
                { value: 20 as const, label: "20 轮", desc: "深度沉浸", detail: "细腻刻画每个学期关键节点" },
                { value: 50 as const, label: "50 轮", desc: "史诗模式", detail: "周级别的微观推演，约 15 分钟" },
              ] as const).map((opt) => {
                const isSelected = totalRounds === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTotalRounds(opt.value)}
                    className={`group relative rounded-xl border p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${
                      isSelected
                        ? "border-primary/40 bg-primary/[0.08] ring-1 ring-primary/20 shadow-[0_6px_20px_-10px_rgba(63,143,155,0.35)]"
                        : "border-border bg-neutral-0/70 hover:border-text-muted/40 hover:bg-surface-elevated"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-text"}`}>
                        {opt.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        isSelected
                          ? "bg-primary/15 text-primary"
                          : "bg-neutral-900/6 text-text-muted group-hover:bg-neutral-900/9"
                      }`}>
                        {opt.desc}
                      </span>
                    </div>
                    <p className={`mt-1.5 text-[11px] leading-relaxed ${isSelected ? "text-primary/80" : "text-text-muted"}`}>
                      {opt.detail}
                    </p>
                    {isSelected && (
                      <motion.span
                        layoutId="round-check"
                        className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-text-inverse"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      >
                        ✓
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>
          </FuturePanel>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface-elevated px-5 py-4 shadow-[0_18px_40px_-32px_rgba(17,24,32,0.35)] sm:px-6 xl:col-span-2 xl:col-start-2">
            <p className="max-w-2xl text-xs leading-5 text-text-secondary">
              共 {totalRounds} 轮决策，每轮 3 个选择，最终生成你的「大学人设卡」。
            </p>
            <Button
              type="submit"
              disabled={submitting}
              theme="light"
              variant="primary"
            >
              {submitting ? "正在准备…" : "开始模拟"}
            </Button>
          </div>

          {error && (
            <p className="rounded-lg border border-danger-300/40 bg-danger-soft px-3 py-2 text-xs text-danger xl:col-span-2 xl:col-start-2">{error}</p>
          )}
        </form>
      </div>
    </FutureShell>
  );
}

function inputClassName() {
  return `w-full rounded-xl border border-border bg-neutral-0/70 px-4 h-12 text-sm text-text
          shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]
          outline-none transition duration-150 placeholder:text-text-placeholder
          hover:border-border-subtle focus:border-accent/60 focus:bg-surface-elevated
          focus:ring-2 focus:ring-accent/15`;
}

function selectClassName() {
  return `w-full appearance-none rounded-xl border border-border bg-neutral-0/70 px-4 pr-10 h-12 text-sm text-text
          shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]
          outline-none transition duration-150
          hover:border-border-subtle focus:border-accent/60 focus:bg-surface-elevated
          focus:ring-2 focus:ring-accent/15`;
}
