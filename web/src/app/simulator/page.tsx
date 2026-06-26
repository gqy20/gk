"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/Select";
import { IconChevronDown } from "@/components/ui/Icon";
import { Slider } from "@/components/ui/Slider";
import { TextField } from "@/components/ui/Field";
import { createSimulatorSession } from "@/lib/future/simulator-client";
import type { School } from "@/lib/data";
import { fetchSchoolDetail, mergeSchoolDetail } from "@/lib/school-details";
import { FuturePanel, FutureShell, SectionHeading } from "../future/FutureShell";
import { RoundSelector, type SimulatorRoundCount } from "./RoundSelector";
import { useGsapScrollReveal } from "@/lib/animation/useGsapScrollReveal";

function splitTags(value: string) {
  return value.split(/[，,\s]+/).map((item) => item.trim()).filter(Boolean);
}

/** 一键开玩的预设档案：覆盖 985/211、理工/综合/财经、文/理/工医典型组合 */
interface PresetProfile {
  id: string;
  badge: string;
  school: string;
  major: string;
  gender: "male" | "female" | "unspecified";
  personalityTags: string;
  interests: string;
  risk: number;
  tagline: string;
}

const PRESETS: PresetProfile[] = [
  {
    id: "tech-explorer",
    badge: "小镇学霸型",
    school: "武汉大学",
    major: "计算机",
    gender: "male",
    personalityTags: "理性 好奇",
    interests: "计算机 社交 阅读",
    risk: 5,
    tagline: "小镇出身，985 理工，期待在大城市找到自己的位置",
  },
  {
    id: "media-explorer",
    badge: "文艺探索型",
    school: "复旦大学",
    major: "新闻传播",
    gender: "female",
    personalityTags: "外向 表达欲强",
    interests: "写作 摄影 社交",
    risk: 7,
    tagline: "985 综合大平台，新闻系，想做不一样的内容",
  },
  {
    id: "engineering-competitor",
    badge: "工科竞赛型",
    school: "哈尔滨工业大学",
    major: "自动化",
    gender: "male",
    personalityTags: "踏实 勤奋",
    interests: "工程 物理 篮球",
    risk: 4,
    tagline: "C9 理工强校，工科实验班出身，准备打竞赛",
  },
  {
    id: "medicine-deep",
    badge: "医学深耕型",
    school: "中山大学",
    major: "临床医学",
    gender: "female",
    personalityTags: "细致 抗压",
    interests: "生物 公益 跑步",
    risk: 3,
    tagline: "八年制临床，目标明确，节奏稳",
  },
  {
    id: "finance-practitioner",
    badge: "财经实践型",
    school: "上海财经大学",
    major: "金融学",
    gender: "male",
    personalityTags: "精明 进取",
    interests: "金融 投资 社交",
    risk: 8,
    tagline: "财经强校，市场化氛围浓，准备冲投行/咨询",
  },
  {
    id: "humanities-free",
    badge: "人文自由型",
    school: "南京大学",
    major: "汉语言文学",
    gender: "unspecified",
    personalityTags: "内敛 求知",
    interests: "文学 哲学 写作",
    risk: 4,
    tagline: "985 文科强校，慢节奏，喜欢安静读书和思考",
  },
];

const FIRST_TIER_CITIES = new Set(["北京", "上海", "广州", "深圳"]);
const NEW_FIRST_TIER_CITIES = new Set([
  "成都",
  "杭州",
  "重庆",
  "武汉",
  "苏州",
  "西安",
  "南京",
  "长沙",
  "郑州",
  "天津",
  "合肥",
  "青岛",
  "东莞",
  "宁波",
  "佛山",
]);
const SECOND_TIER_CITIES = new Set([
  "济南",
  "无锡",
  "沈阳",
  "昆明",
  "福州",
  "厦门",
  "温州",
  "石家庄",
  "大连",
  "哈尔滨",
  "金华",
  "泉州",
  "南宁",
  "长春",
  "常州",
  "南昌",
  "南通",
  "贵阳",
  "嘉兴",
  "徐州",
  "惠州",
  "太原",
  "烟台",
  "临沂",
  "保定",
  "台州",
  "绍兴",
  "珠海",
  "洛阳",
  "潍坊",
]);
const CITY_NAMES = [
  ...FIRST_TIER_CITIES,
  ...NEW_FIRST_TIER_CITIES,
  ...SECOND_TIER_CITIES,
];

function normalizeCityName(value: string) {
  return value.trim().replace(/市$/, "");
}

function extractSchoolCity(school: School | null) {
  if (!school) return "";
  if (["北京", "上海", "天津", "重庆"].includes(school.province)) {
    return school.province;
  }

  const locationText = [
    school.detail?.basic_info?.location,
    school.detail?.basic_info?.address,
  ].filter(Boolean).join(" ");

  const knownCity = CITY_NAMES.find((city) => locationText.includes(city));
  if (knownCity) return knownCity;

  const cityMatch = locationText.match(/([\u4e00-\u9fa5]{2,8})市/);
  return cityMatch ? cityMatch[1] : "";
}

function getCityTier(city: string) {
  const normalized = normalizeCityName(city);
  if (FIRST_TIER_CITIES.has(normalized)) return "一线城市";
  if (NEW_FIRST_TIER_CITIES.has(normalized)) return "新一线城市";
  if (SECOND_TIER_CITIES.has(normalized)) return "二线城市";
  return "其他城市";
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
  const searchParams = useSearchParams();
  const initialSchool = searchParams.get("school") || "";
  const initialProvince = searchParams.get("province") || "";
  const initialCity = searchParams.get("city") || "";
  const initialMajor = searchParams.get("major") || "";
  const [targetSchool, setTargetSchool] = useState(initialSchool);
  const [targetCity, setTargetCity] = useState(initialCity);
  const [targetMajor, setTargetMajor] = useState(initialMajor);
  const [gender, setGender] = useState<"male" | "female" | "unspecified">("unspecified");
  const [personalityTags, setPersonalityTags] = useState("理性 好奇");
  const [interests, setInterests] = useState("计算机 社交 阅读");
  const [riskTolerance, setRiskTolerance] = useState(5);
  const [totalRounds, setTotalRounds] = useState<SimulatorRoundCount>(8);
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStartedAt, setSubmitStartedAt] = useState<number | null>(null);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  useGsapScrollReveal(scrollRootRef, []);

  useEffect(() => {
    router.prefetch("/simulator/play");
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    fetch("/data/schools-index.json")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSchools(data.schools || []);
      })
      .catch(() => {
        if (!cancelled) setSchools([]);
      });

    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    if (!selectedSchoolData || selectedSchoolData.detail) return;
    let cancelled = false;

    fetchSchoolDetail(selectedSchoolData.name)
      .then((detailSchool) => {
        if (cancelled || !detailSchool) return;
        setSchools((current) => mergeSchoolDetail(current, detailSchool));
      })
      .catch(() => {
        // 详情只用于专业候选、城市推断和学校类型推断，失败不阻断模拟。
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSchoolData]);

  const effectiveCity = targetCity || extractSchoolCity(selectedSchoolData) || initialProvince || selectedSchoolData?.province || "";
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
      cityTier: getCityTier(effectiveCity),
      schoolTier: tiers.length > 0 ? tiers.join("+") : undefined,
      schoolType: inferredType,
    };
  }, [effectiveCity, selectedSchoolData]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitStartedAt(Date.now());
    setError(null);
    try {
      const session = await createSimulatorSession({
        profile: {
          school: targetSchool || "一所双一流大学",
          major: targetMajor || undefined,
          gender,
          province: schoolContext.province,
          city: effectiveCity || undefined,
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
      setError(formatSimulatorStartError(err));
      setSubmitting(false);
      setSubmitStartedAt(null);
    }
  }

  /** 一键应用预设档案（不立刻开始，让用户先看到表单被填充） */
  function applyPreset(preset: PresetProfile) {
    setTargetSchool(preset.school);
    setTargetMajor(preset.major);
    setGender(preset.gender);
    setPersonalityTags(preset.personalityTags);
    setInterests(preset.interests);
    setRiskTolerance(preset.risk);
    const found = schools.find((s) => s.name === preset.school);
    setTargetCity(extractSchoolCity(found || null));
    setError(null);
    // 填充后自动收起快速开始，让表单成为焦点
    setQuickStartOpen(false);
    // 滚动到下方表单，让用户看到填充结果
    requestAnimationFrame(() => {
      document.getElementById("simulator-setup-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /** 一键应用 + 立刻开玩（适合完全信任 preset 的老用户） */
  async function startWithPreset(preset: PresetProfile) {
    if (submitting) return;
    applyPreset(preset);
    // 等 React 把 state 落地再提交
    setTimeout(() => {
      const form = document.getElementById("simulator-setup-form") as HTMLFormElement | null;
      form?.requestSubmit();
    }, 80);
  }

  return (
    <FutureShell
      title="大学人生模拟器"
      backHref="/"
      backLabel="返回"
      mainClassName="pb-10"
      contentMaxClassName="max-w-none"
      headerMaxClassName="max-w-none"
    >
      <div ref={scrollRootRef} className="space-y-6">
        {/* 顶部 Hero + 可折叠的快速开始 preset */}
        <div data-scroll-reveal>
          <FuturePanel className="overflow-hidden p-0">
            {/* Hero 标题区 + 快速开始折叠栏 —— 合并为单行 */}
            <div className="bg-gradient-to-br from-brand-50/55 via-surface-elevated to-accent-50/35 px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                {/* 左侧：标题 + 副标题 */}
                <div className="min-w-0">
                  <h1 className="text-xl font-bold tracking-tight text-text sm:text-2xl">
                    选一所学校，8 轮选择，看看你四年后会变成什么样
                  </h1>
                  <p className="mt-1 max-w-2xl text-xs leading-6 text-text-secondary sm:text-sm sm:leading-7">
                    基于你的学校、专业、性格和风险偏好，由 AI 推演一段真实的中国大学生活，最终生成一张「大学人设卡」。
                  </p>
                </div>

                {/* 右侧：快速开始折叠按钮 */}
                <button
                  type="button"
                  onClick={() => setQuickStartOpen((v) => !v)}
                  className="shrink-0 group flex items-center gap-2 rounded-lg border border-border bg-surface-elevated/80 px-3 py-2 transition hover:border-primary/30 hover:bg-surface-elevated sm:px-3.5"
                  aria-expanded={quickStartOpen}
                >
                  <span className="text-xs font-semibold text-text group-hover:text-primary">
                    快速开始
                  </span>
                  <span className="rounded-full border border-primary/25 bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {PRESETS.length} 个预设
                  </span>
                  <IconChevronDown
                    size={12}
                    className={`text-text-muted transition-transform duration-200 ${quickStartOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {/* 展开的预设卡片网格 */}
              {quickStartOpen && (
                <div className="mt-4 border-t border-border/60 pt-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {PRESETS.map((preset) => (
                      <PresetCard
                        key={preset.id}
                        preset={preset}
                        onApply={() => applyPreset(preset)}
                        onStart={() => startWithPreset(preset)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </FuturePanel>
        </div>

        <form id="simulator-setup-form" onSubmit={handleSubmit} className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div data-scroll-reveal data-scroll-y="10" className="xl:sticky xl:top-[4.5rem]">
            <FuturePanel as="aside" className="space-y-5 p-5">
              <div>
                <SectionHeading title="模拟前设置" description={`用 ${totalRounds} 轮选择看见一段更具体的大学四年。`} />
                <p className="mt-4 text-sm leading-7 text-text-secondary">
                  先确认学校、专业和个人偏好。开始后，每一轮只需要选一个最像你的做法。
                </p>
              </div>
              <div className="grid gap-2 border-t border-border/70 pt-4">
                <SetupMetric label="当前轮数" value={`${totalRounds} 轮`} />
                <SetupMetric label="每轮选择" value="3 个" />
                <SetupMetric label="城市层级" value={effectiveCity ? getCityTier(effectiveCity) : "待推断"} />
              </div>
            </FuturePanel>
          </div>

          <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-5">
              <div data-scroll-reveal>
                <FuturePanel className="p-5 sm:p-6">
                  <SectionHeading title="你的大学设定" description="选择你想模拟的学校和专业，这会影响场景内容。" />
                  <div className="mt-5 grid gap-x-5 gap-y-4 md:grid-cols-2">
                    <ChoiceSelect
                      label="目标学校"
                      value={targetSchool}
                      placeholder="选择学校（或保持默认）"
                      options={schools.map((s) => s.name)}
                      onChange={(name) => {
                        setTargetSchool(name);
                        const found = schools.find((s) => s.name === name);
                        setTargetCity(extractSchoolCity(found || null));
                      }}
                    />

                    <ChoiceSelect
                      label="专业方向"
                      value={targetMajor}
                      placeholder="选择专业（可选）"
                      options={majorOptions}
                      onChange={setTargetMajor}
                    />

                    <ChoiceSelect
                      label="性别设定"
                      value={gender}
                      className="md:col-span-2"
                      options={[
                        { value: "unspecified", label: "不指定，宿舍场景避免性别化描写" },
                        { value: "male", label: "男生" },
                        { value: "female", label: "女生" },
                      ]}
                      onChange={(nextValue) => setGender(nextValue as "male" | "female" | "unspecified")}
                    />
                  </div>
                </FuturePanel>
              </div>

              <div data-scroll-reveal>
                <FuturePanel className="p-5 sm:p-6">
                  <SectionHeading title="你的性格" description="这些标签会让场景和选项更贴合你。" />
                  <div className="mt-5 grid gap-x-5 gap-y-4 md:grid-cols-2">
                    <TextField
                      label="性格标签"
                      value={personalityTags}
                      onChange={(e) => setPersonalityTags(e.target.value)}
                      placeholder="用空格分隔，如：理性 好奇 内向"
                    />
                    <TextField
                      label="兴趣方向"
                      value={interests}
                      onChange={(e) => setInterests(e.target.value)}
                      placeholder="用空格分隔，如：计算机 社交 运动"
                    />
                  </div>

                  <div className="mt-5 rounded-xl bg-neutral-0/45 p-4">
                    <Slider
                      aria-label="冒险倾向"
                      min={1}
                      max={10}
                      step={1}
                      value={riskTolerance}
                      onChange={(v) => setRiskTolerance(v)}
                      minLabel="稳健谨慎"
                      midLabel="均衡"
                      maxLabel="冒险探索"
                    />
                  </div>
                </FuturePanel>
              </div>
            </div>

            <div data-scroll-reveal data-scroll-y="10" className="2xl:sticky 2xl:top-[4.5rem]">
              <FuturePanel className="p-5 sm:p-6">
                <SectionHeading title="模拟轮数" description="选择你想体验的决策深度。" />
                <RoundSelector value={totalRounds} onChange={setTotalRounds} />
              </FuturePanel>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface-elevated px-5 py-4 shadow-[0_10px_24px_-22px_rgba(17,24,32,0.28)] sm:px-6 2xl:col-span-2">
              <p className="max-w-2xl text-xs leading-5 text-text-secondary">
                共 {totalRounds} 轮决策，每轮 3 个选择，最终生成你的「大学人设卡」。
              </p>
              <Button
                type="submit"
                disabled={submitting}
                theme="light"
                variant="primary"
                className="min-w-[7.5rem]"
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                    正在准备
                  </>
                ) : (
                  "开始模拟"
                )}
              </Button>
            </div>

            {submitting && (
              <PreparingSimulatorPanel
                startedAt={submitStartedAt}
                school={targetSchool || "目标学校"}
                major={targetMajor || "专业方向"}
              />
            )}

            {error && (
              <p className="rounded-lg border border-danger-300/40 bg-danger-soft px-3 py-2 text-xs text-danger 2xl:col-span-2">{error}</p>
            )}
          </div>
        </form>
      </div>
    </FutureShell>
  );
}

function formatSimulatorStartError(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  if (/api key|invalid_api_key|incorrect api key/i.test(message)) {
    return "AI 服务配置暂时不可用，请检查服务密钥后再试。";
  }
  if (/timeout|timed out|network/i.test(message)) {
    return "生成第一轮场景超时了，请稍后重试。";
  }
  if (message.trim()) {
    return "创建模拟失败，请稍后重试。";
  }
  return "创建模拟失败，请稍后重试。";
}

function PreparingSimulatorPanel({
  startedAt,
  school,
  major,
}: {
  startedAt: number | null;
  school: string;
  major: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 500);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const seconds = Math.floor(elapsed / 1000);
  const progress = Math.min(88, Math.round((1 - Math.exp(-elapsed / 18_000)) * 92));
  const activeStep = seconds < 3 ? 0 : seconds < 10 ? 1 : 2;
  const steps = [
    "整理学校、专业和个人偏好",
    "生成第一轮大学生活场景",
    "准备 3 个可选择的做法",
  ];

  return (
    <div
      role="status"
      aria-live="polite"
      className="overflow-hidden rounded-2xl border border-accent/20 bg-accent/6 p-4 shadow-[0_10px_24px_-22px_rgba(17,24,32,0.28)] sm:p-5 2xl:col-span-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">正在准备第一轮模拟</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            已等待 {seconds}s，正在根据 {school} 和 {major} 生成开局场景。
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-surface-elevated px-3 py-1.5 text-xs font-medium text-accent">
          <span aria-hidden className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
            <span className="relative h-2 w-2 rounded-full bg-accent" />
          </span>
          生成中
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => {
          const done = index < activeStep;
          const active = index === activeStep;
          return (
            <div
              key={step}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                done || active
                  ? "border-accent/20 bg-surface-elevated text-text-secondary"
                  : "border-border/70 bg-surface-subtle/50 text-text-muted"
              }`}
            >
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 rounded-full ${
                  done ? "bg-accent" : active ? "animate-pulse bg-accent" : "bg-text-muted/30"
                }`}
              />
              <span className="min-w-0 leading-5">{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SetupMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface-subtle/60 px-3 py-2.5">
      <span className="text-[11px] leading-4 text-text-muted">{label}</span>
      <span className="text-sm font-semibold text-text">{value}</span>
    </div>
  );
}

function ChoiceSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "请选择",
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { value: string; label: string }>;
  placeholder?: string;
  className?: string;
}) {
  const emptyValue = "__empty";
  const normalizedOptions = value && !options.some((option) => getOptionValue(option) === value)
    ? [value, ...options]
    : options;
  const selectedOption = normalizedOptions.find((option) => getOptionValue(option) === value);
  const displayValue = selectedOption ? getOptionLabel(selectedOption) : placeholder;

  return (
    <Label className={className}>
      <span>{label}</span>
      <Select
        value={value || emptyValue}
        onValueChange={(nextValue) => onChange(nextValue === emptyValue ? "" : nextValue)}
      >
        <SelectTrigger>
          <span className={value ? "truncate" : "truncate text-text-placeholder"}>{displayValue}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptyValue}>{placeholder}</SelectItem>
          {normalizedOptions.map((option) => (
            <SelectItem key={getOptionValue(option)} value={getOptionValue(option)}>
              {getOptionLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Label>
  );
}

function getOptionValue(option: string | { value: string; label: string }) {
  return typeof option === "string" ? option : option.value;
}

function getOptionLabel(option: string | { value: string; label: string }) {
  return typeof option === "string" ? option : option.label;
}

function PresetCard({
  preset,
  onApply,
  onStart,
}: {
  preset: PresetProfile;
  onApply: () => void;
  onStart: () => void;
}) {
  return (
    <div className="group relative flex flex-col gap-2 rounded-xl border border-border bg-neutral-0/55 p-3.5 transition hover:border-primary/30 hover:bg-surface-elevated">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className="shrink-0 inline-flex items-center rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary">
            {preset.badge}
          </span>
          <span className="truncate text-sm font-semibold text-text">
            {preset.school} · {preset.major}
          </span>
        </div>
        <span className="shrink-0 text-[10px] text-text-muted">风险 {preset.risk}/10</span>
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-[11px] leading-5 text-text-secondary">{preset.tagline}</p>
        <div className="flex shrink-0 gap-1">
          {splitTags(preset.personalityTags).slice(0, 2).map((t) => (
            <span key={t} className="rounded-md border border-border/70 bg-neutral-900/3 px-1.5 py-0.5 text-[10px] text-text-muted">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onStart}
          className="flex-1 rounded-lg border border-accent/35 bg-accent px-3 py-1.5 text-xs font-medium text-text-inverse transition hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
        >
          一键开玩
        </button>
        <button
          type="button"
          onClick={onApply}
          className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-muted transition hover:border-accent/40 hover:text-text-secondary"
        >
          填充表单
        </button>
      </div>
    </div>
  );
}
