"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { createSimulatorSession } from "@/lib/future/simulator-client";
import type { School } from "@/lib/data";
import { FuturePanel, FutureShell, SectionHeading } from "../future/FutureShell";
import { RoundSelector, type SimulatorRoundCount } from "./RoundSelector";

function splitTags(value: string) {
  return value.split(/[，,\s]+/).map((item) => item.trim()).filter(Boolean);
}

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

  useEffect(() => {
    let cancelled = false;

    fetch("/data/schools.json")
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
    setSubmitting(true);
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
      mainClassName="pb-10"
      contentMaxClassName="max-w-[1600px]"
    >
      <div className="mx-auto max-w-[1480px]">
        <form onSubmit={handleSubmit} className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <FuturePanel as="aside" className="space-y-5 p-5 xl:sticky xl:top-[4.5rem]">
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

          <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-5">
              <FuturePanel className="p-5 sm:p-6">
                <SectionHeading title="你的大学设定" description="选择你想模拟的学校和专业，这会影响场景内容。" />
                <div className="mt-5 grid gap-x-5 gap-y-4 md:grid-cols-2">
                  <Label>
                    <span>目标学校</span>
                    <span className="relative block">
                      <NativeSelect
                        value={targetSchool}
                        onChange={(e) => {
                          const name = e.target.value;
                          setTargetSchool(name);
                          const found = schools.find((s) => s.name === name);
                          setTargetCity(extractSchoolCity(found || null));
                        }}
                      >
                        <option value="">选择学校（或保持默认）</option>
                        {schools.map((s) => (
                          <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                      </NativeSelect>
                    </span>
                  </Label>

                  <Label>
                    <span>专业方向</span>
                    <span className="relative block">
                      <NativeSelect
                        value={targetMajor}
                        onChange={(e) => setTargetMajor(e.target.value)}
                      >
                        <option value="">选择专业（可选）</option>
                        {majorOptions.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </NativeSelect>
                    </span>
                  </Label>

                  <Label className="md:col-span-2">
                    <span>性别设定</span>
                    <span className="relative block">
                      <NativeSelect
                        value={gender}
                        onChange={(e) => setGender(e.target.value as "male" | "female" | "unspecified")}
                      >
                        <option value="unspecified">不指定，宿舍场景避免性别化描写</option>
                        <option value="male">男生</option>
                        <option value="female">女生</option>
                      </NativeSelect>
                    </span>
                  </Label>
                </div>
              </FuturePanel>

              <FuturePanel className="p-5 sm:p-6">
                <SectionHeading title="你的性格" description="这些标签会让场景和选项更贴合你。" />
                <div className="mt-5 grid gap-x-5 gap-y-4 md:grid-cols-2">
                  <Label>
                    <span>性格标签</span>
                    <Input
                      value={personalityTags}
                      onChange={(e) => setPersonalityTags(e.target.value)}
                      placeholder="用空格分隔，如：理性 好奇 内向"
                    />
                  </Label>
                  <Label>
                    <span>兴趣方向</span>
                    <Input
                      value={interests}
                      onChange={(e) => setInterests(e.target.value)}
                      placeholder="用空格分隔，如：计算机 社交 运动"
                    />
                  </Label>
                </div>

                <Label className="mt-5 rounded-xl bg-neutral-0/45 p-4">
                  <span className="flex items-center justify-between gap-3">
                    <span>冒险倾向</span>
                    <span className="font-mono text-sm font-semibold text-text">{riskTolerance}/10</span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={riskTolerance}
                    onChange={(e) => setRiskTolerance(Number(e.target.value))}
                    className="future-risk-slider mt-4 w-full"
                  />
                  <span className="mt-3 flex justify-between text-[11px] text-text-muted">
                    <span>稳健谨慎</span>
                    <span>均衡</span>
                    <span>冒险探索</span>
                  </span>
                </Label>
              </FuturePanel>
            </div>

            <FuturePanel className="p-5 sm:p-6 2xl:sticky 2xl:top-[4.5rem]">
              <SectionHeading title="模拟轮数" description="选择你想体验的决策深度。" />
              <RoundSelector value={totalRounds} onChange={setTotalRounds} />
            </FuturePanel>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface-elevated px-5 py-4 shadow-[0_10px_24px_-22px_rgba(17,24,32,0.28)] sm:px-6 2xl:col-span-2">
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
              <p className="rounded-lg border border-danger-300/40 bg-danger-soft px-3 py-2 text-xs text-danger 2xl:col-span-2">{error}</p>
            )}
          </div>
        </form>
      </div>
    </FutureShell>
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
