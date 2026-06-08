/**
 * 大学人生模拟器 — 服务端逻辑
 *
 * 优先使用 PostgreSQL（Neon）持久化会话，
 * 无 DATABASE_URL 时降级为内存存储。
 */

import { AnthropicProvider } from "./anthropic";
import { getPostgresPool } from "./pg-client";
import { SimulatorPostgresRepository, SIMULATOR_SCHEMA_SQL } from "./simulator-repository";
import { simulateStepTool, generateEndingTool } from "./simulator-schema";
import { createLogger } from "./logger";
import type {
  SimulateSession,
  SimulateStartInput,
  SimulateHistoryEntry,
  SimulateStepResult,
  SimulatorEnding,
} from "./simulator-types";

const log = createLogger("simulator-server");

// ── Repository 工厂：PostgreSQL > 内存降级 ─────────

interface ISimulatorRepo {
  createSession(input: SimulateStartInput, initialScene: Record<string, unknown>): Promise<string>;
  getSession(sessionId: string): Promise<SimulateSession | null>;
  advanceStep(sessionId: string, params: {
    newRound: number;
    historyEntry: SimulateHistoryEntry;
    nextScene: Record<string, unknown> | null;
    isFinal: boolean;
    ending?: Record<string, unknown>;
  }): Promise<void>;
  markError(sessionId: string, error: string): Promise<void>;
}

/** 内存降级实现（无 DATABASE_URL 时使用） */
class MemorySimulatorRepo implements ISimulatorRepo {
  private sessions = new Map<string, SimulateSession>();

  async createSession(input: SimulateStartInput, initialScene: Record<string, unknown>): Promise<string> {
    const id = `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const session: SimulateSession = {
      sessionId: id,
      status: "playing",
      profile: input.profile,
      currentRound: 0,
      totalRounds: input.totalRounds ?? 8,
      history: [],
      currentScene: initialScene as unknown as SimulateSession["currentScene"],
      ending: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, session);
    return id;
  }

  async getSession(sessionId: string): Promise<SimulateSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async advanceStep(_sessionId: string, params: {
    newRound: number;
    historyEntry: SimulateHistoryEntry;
    nextScene: Record<string, unknown> | null;
    isFinal: boolean;
    ending?: Record<string, unknown>;
  }): Promise<void> {
    // 内存模式不通过此方法更新，由调用方直接操作 session 对象后 set 回 Map
    // （保持与旧代码兼容的简化路径）
  }

  async markError(_sessionId: string, _error: string): Promise<void> {}

  /** 直接写入/读取 session 对象（内存模式专用） */
  put(session: SimulateSession) { this.sessions.set(session.sessionId, session); }
  get(sessionId: string) { return this.sessions.get(sessionId); }
}

let repoInstance: ISimulatorRepo | MemorySimulatorRepo | null = null;

function getRepo(): ISimulatorRepo | MemorySimulatorRepo {
  if (repoInstance) return repoInstance;

  try {
    const db = getPostgresPool();
    const pgRepo = new SimulatorPostgresRepository(db);

    // 确保表存在
    db.query(SIMULATOR_SCHEMA_SQL).catch((err) => {
      log.error({ err: String(err) }, "Failed to ensure simulator_sessions table");
    });

    repoInstance = pgRepo;
    log.info("Using PostgreSQL repository for simulator");
    return pgRepo;
  } catch {
    // 无 DATABASE_URL → 降级到内存
    repoInstance = new MemorySimulatorRepo();
    log.warn("No DATABASE_URL, falling back to in-memory simulator storage");
    return repoInstance;
  }
}

// ── Prompt 构建工具 ────────────────────────────────

function buildSystemPrompt(profile: SimulateStartInput["profile"], round: number, totalRounds: number): string {
  // 构建学校上下文段落
  const schoolContextLines: string[] = [];
  if (profile.schoolTier) schoolContextLines.push(`学校层次：${profile.schoolTier}`);
  if (profile.schoolType) schoolContextLines.push(`学校类型：${profile.schoolType}`);
  if (profile.province) schoolContextLines.push(`所在省份：${profile.province}`);
  if (profile.city) schoolContextLines.push(`所在城市：${profile.city}`);

  return `你是一个沉浸式大学人生模拟器的叙事引擎。用户正在体验一所中国大学的四年生活。当前时间是 2026 年。

## 用户档案
- 学校：${profile.school}${schoolContextLines.length > 0 ? `\n${schoolContextLines.map((l) => `- ${l}`).join("\n")}` : ""}
${profile.major ? `- 专业方向：${profile.major}` : ""}
- 性格标签：${profile.personalityTags.join("、") || "未指定"}
- 兴趣方向：${profile.interests.join("、") || "未指定"}
- 风险偏好：${profile.riskTolerance}/10

## 当前进度
第 ${round} / ${totalRounds} 轮

## 叙事规则
1. 用第二人称"你"叙述，营造代入感
2. 场景要真实、具体，符合 2026 年中国大学校园生活（宿舍/食堂/图书馆/教室/社团/实习等），可以适当融入当下热点和时代特征
3. **根据学校的省份、城市、类型、层次来定制场景细节**：
   - 不同城市的消费水平、气候、交通方式会影响日常描述（如北京地铁 vs 武汉公交 vs 成都骑行）
   - 学校类型影响校园氛围（师范类偏文静/教育氛围浓厚，理工类偏实验室/项目导向，综合类多元活跃）
   - 学校层次影响竞争强度和资源描述（985/211 提及更多科研机会和内卷氛围，普通双一流更接地气）
   - 南北方差异（供暖、饮食、开学时间）要体现在场景中
4. 3个选项要有明显不同的性格倾向（如：外向社交 vs 内向专注 vs 观望试探）
5. 选项不要有明显的"正确答案"，每个选择都有合理的利弊
6. 场景随回合推进而变化：
   - 前几轮（1-3）：入学适应、认识人、选课、社团
   - 中间轮（4-6）：学业压力、人际关系、第一次实习/项目
   - 后面轮（7-8）：考研/就业抉择、毕业季、回顾总结
7. outcome 的 effects 要简洁有力（如"绩点+1""认识了学长""错过了一次聚会"）
8. 保持中文输出`;
}

function buildUserPromptForRound(
  profile: SimulateStartInput["profile"],
  history: SimulateHistoryEntry[],
  previousChoiceLabel?: string,
): string {
  if (history.length === 0) {
    return `请生成第1轮场景。这是大学生活的开始——通常是入学报到或刚到学校的第一周。

请直接开始叙述，不需要任何开场白。`;
  }

  const lastEntry = history[history.length - 1]!;
  return `## 决策历史
${history.map((h) => `**第${h.round}轮 — ${h.scene_title}**
选择了：${h.choiceLabel}
结果：${h.outcome_narrative}
影响：${h.outcome_effects.join("、")}`).join("\n\n")}

## 用户上一轮的选择
用户在第 ${lastEntry.round} 轮选择了：${previousChoiceLabel || lastEntry.choiceLabel}

请先给出这个选择的推演结果（outcome），然后生成下一轮的场景和3个新选择。保持叙事连贯性，让之前的选择对当前场景产生合理的影响。`;
}

function buildEndingPrompt(
  profile: SimulateStartInput["profile"],
  history: SimulateHistoryEntry[],
): string {
  const contextParts = [profile.school];
  if (profile.schoolTier) contextParts.push(profile.schoolTier);
  if (profile.schoolType) contextParts.push(profile.schoolType);
  if (profile.province) contextParts.push(profile.province);
  if (profile.major) contextParts.push(profile.major);

  return `## 用户档案
- 学校：${contextParts.join(" · ")}

## 完整决策历史（共 ${history.length} 轮）
${history.map((h) => `第${h.round}轮 [${h.scene_title}] → 选了「${h.choiceLabel}」→ ${h.outcome_effects.join(",")}`).join("\n")}

请根据以上所有决策，生成这个人大学四年的最终人设卡。要让人感觉每个决策都影响了最终结果。结合学校的地域、类型、层次特点来评价这个人的大学生活。`;
}

function isSimulatorChoice(value: unknown): value is SimulateStepResult["choices"][number] {
  if (!value || typeof value !== "object") return false;
  const choice = value as { id?: unknown; label?: unknown };
  return typeof choice.id === "string" && choice.id.trim().length > 0
    && typeof choice.label === "string" && choice.label.trim().length > 0;
}

function normalizeStepResult(rawStep: unknown, fallbackRound: number, isFinal: boolean): SimulateStepResult {
  if (!rawStep || typeof rawStep !== "object") {
    throw new Error("Simulator model returned an empty step");
  }

  const step = rawStep as Partial<SimulateStepResult>;
  const choices = Array.isArray(step.choices) ? step.choices : [];

  if (
    typeof step.scene_title !== "string"
    || !step.scene_title.trim()
    || typeof step.scene_description !== "string"
    || !step.scene_description.trim()
    || choices.length !== 3
    || !choices.every(isSimulatorChoice)
  ) {
    throw new Error("Simulator model returned an invalid scene");
  }

  return {
    ...step,
    round: typeof step.round === "number" ? step.round : fallbackRound,
    scene_title: step.scene_title,
    scene_description: step.scene_description,
    choices: choices as SimulateStepResult["choices"],
    is_final: isFinal,
  };
}

// ── 核心逻辑 ───────────────────────────────────────

export interface SimulatorServerOptions {
  provider?: AnthropicProvider;
}

function getProvider(options?: SimulatorServerOptions): AnthropicProvider {
  if (options?.provider) return options.provider;

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) is required");
  }

  return new AnthropicProvider({
    apiKey,
    baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
    model: process.env.SIMULATOR_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    anthropicVersion: process.env.ANTHROPIC_VERSION || "2023-06-01",
  });
}

/** 创建游戏会话 + 初始化第1轮 */
export async function handleCreateSimulatorSession(
  input: SimulateStartInput,
  options: SimulatorServerOptions = {},
): Promise<SimulateSession> {
  const provider = getProvider(options);
  const totalRounds = input.totalRounds ?? 8;
  const repo = getRepo();

  log.info({ school: input.profile.school, totalRounds }, "Creating simulator session");

  // 调用 LLM 生成第1轮场景
  const systemPrompt = buildSystemPrompt(input.profile, 1, totalRounds);
  const userPrompt = buildUserPromptForRound(input.profile, []);

  const { data: rawStep } = await provider.generateStructured<typeof simulateStepTool>({
    system: systemPrompt,
    user: userPrompt,
    tool: simulateStepTool,
    temperature: 0.85,
    maxTokens: 2048,
    timeoutMs: 60_000,
  });
  const stepResult = normalizeStepResult(rawStep, 1, 1 >= totalRounds);

  const initialScene = {
    ...stepResult,
    round: 1,
    is_final: 1 >= totalRounds,
  };

  const sessionId = await repo.createSession(input, initialScene);

  // 从 repo 读回完整 session 返回
  const session = await repo.getSession(sessionId);
  if (!session) throw new Error("Failed to retrieve created session");

  log.info({ sessionId }, "Simulator session created with round 1");
  return session;
}

/** 提交选择 → 推演下一步 */
export async function handleSimulateStep(
  sessionId: string,
  choiceId: string,
  options: SimulatorServerOptions = {},
): Promise<{ session: SimulateSession; result: SimulateStepResult; ending?: SimulatorEnding }> {
  const repo = getRepo();
  let session = await repo.getSession(sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  if (session.status !== "playing") {
    throw new Error(`Session is not playing: ${session.status}`);
  }
  if (!session.currentScene) {
    throw new Error("No current scene available");
  }

  const provider = getProvider(options);
  const nextRound = session.currentRound + 1;
  const isFinal = nextRound >= session.totalRounds;

  log.info({ sessionId, choiceId, round: nextRound, isFinal }, "Processing simulator step");

  // 找到用户选择的选项
  const chosenChoice = session.currentScene.choices.find((c) => c.id === choiceId);
  if (!chosenChoice) {
    throw new Error(`Invalid choiceId: ${choiceId}`);
  }

  // 调用 LLM 推演
  const systemPrompt = buildSystemPrompt(session.profile, nextRound + 1, session.totalRounds);
  const userPrompt = buildUserPromptForRound(session.profile, session.history, chosenChoice.label);

  const { data: rawStep } = await provider.generateStructured<typeof simulateStepTool>({
    system: systemPrompt,
    user: userPrompt,
    tool: simulateStepTool,
    temperature: 0.85,
    maxTokens: 2048,
    timeoutMs: 60_000,
  });
  const stepResult = normalizeStepResult(rawStep, nextRound + 1, nextRound + 1 >= session.totalRounds);

  // 构建历史记录
  const historyEntry: SimulateHistoryEntry = {
    round: nextRound,
    scene_title: session.currentScene.scene_title,
    choiceId,
    choiceLabel: chosenChoice.label,
    outcome_narrative: stepResult.outcome?.narrative || "",
    outcome_effects: stepResult.outcome?.effects || [],
  };

  // 如果是最后一轮，同时生成结局
  let ending: SimulatorEnding | null = null;
  let endingRaw: Record<string, unknown> | undefined;
  if (isFinal) {
    const updatedHistory = [...session.history, historyEntry];
    const endingPrompt = buildEndingPrompt(session.profile, updatedHistory);
    const { data: rawEnding } = await provider.generateStructured<typeof generateEndingTool>({
      system: "你是一个善于总结和洞察的大学人生观察者。根据完整的决策历史，为用户生成一个真实、贴切、不鸡汤的大学人设卡。",
      user: endingPrompt,
      tool: generateEndingTool,
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 60_000,
    });
    ending = rawEnding as unknown as SimulatorEnding;
    endingRaw = rawEnding as unknown as Record<string, unknown>;
  }

  // 持久化到 DB（或内存）
  const nextScene = isFinal ? null : {
    ...stepResult,
    round: nextRound + 1,
    is_final: nextRound + 1 >= session.totalRounds,
  };

  if ("advanceStep" in repo) {
    // PostgreSQL 模式
    await repo.advanceStep(sessionId, {
      newRound: nextRound,
      historyEntry,
      nextScene,
      isFinal,
      ending: endingRaw,
    });
  } else {
    // 内存降级模式
    (repo as MemorySimulatorRepo).put({
      ...session,
      currentRound: nextRound,
      status: isFinal ? "ended" : "playing",
      history: [...session.history, historyEntry],
      currentScene: nextScene as unknown as SimulateSession["currentScene"],
      ending,
      updatedAt: new Date().toISOString(),
    });
  }

  // 读回最新状态
  session = await repo.getSession(sessionId);

  log.info({
    sessionId,
    round: nextRound,
    isFinal,
    status: session?.status,
  }, "Step processed");

  return {
    session: session!,
    result: {
      ...stepResult,
      round: nextRound,
      is_final: isFinal,
    },
    ...(ending ? { ending } : {}),
  };
}

/** 获取会话状态 */
export async function handleGetSimulatorSession(
  sessionId: string,
): Promise<SimulateSession> {
  const repo = getRepo();
  const session = await repo.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  return session;
}
