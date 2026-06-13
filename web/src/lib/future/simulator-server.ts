/**
 * 大学人生模拟器 — 服务端逻辑
 *
 * 优先使用 PostgreSQL（Neon）持久化会话，
 * 无 DATABASE_URL 时降级为内存存储。
 */

import { AnthropicProvider, type StreamEvent, type StreamEventCallback } from "./anthropic";
import type { GenerateStructuredInput, GenerateStructuredResult } from "./anthropic";
import { getPostgresPool } from "./pg-client";
import { SimulatorPostgresRepository, SIMULATOR_SCHEMA_SQL, type SimulatorShareRecord } from "./simulator-repository";
import { simulateStepTool, generateEndingTool } from "./simulator-schema";
import {
  buildSystemPrompt,
  buildUserPromptForRound,
  buildEndingPrompt,
  getEndingSystemPrompt,
} from "./simulator-prompts";
import { createLogger } from "./logger";
import type {
  SimulateSession,
  SimulateStartInput,
  SimulateHistoryEntry,
  SimulateStepResult,
  SimulatorEnding,
} from "./simulator-types";

const log = createLogger("simulator-server");

// ── LLM 调用重试包装 ──────────────────────────────

/**
 * 对 generateStructured 做重试包装，处理"并发压力下 thinking 失控"
 * 导致 missing tool_use / max_tokens 截断 / JSON 解析失败这三类失败。
 *
 * 策略：
 * - attempt 1：原始参数
 * - attempt 2：相同参数再试一次（瞬时网络/调度问题最常见）
 * - attempt 3：温度降低 + maxTokens 翻倍（减少 thinking 长度抖动）
 *
 * 仅对可恢复错误重试；4xx/认证错误立即抛出。
 */
async function generateStructuredWithRetry<T extends import("./anthropic").StructuredToolShape>(
  provider: AnthropicProvider,
  args: GenerateStructuredInput<T>,
): Promise<GenerateStructuredResult<unknown>> {
  const baseMax = args.maxTokens ?? 4096;
  const baseTemp = args.temperature ?? 0.75;

  const attempts: Array<{ label: string; maxTokens: number; temperature: number }> = [
    { label: "primary", maxTokens: baseMax, temperature: baseTemp },
    { label: "retry-same", maxTokens: baseMax, temperature: baseTemp },
    { label: "retry-loose", maxTokens: Math.min(baseMax * 2, 16384), temperature: Math.max(0.3, baseTemp - 0.3) },
  ];

  let lastErr: Error | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i]!;
    try {
      const result = await provider.generateStructured<T>({
        ...args,
        maxTokens: a.maxTokens,
        temperature: a.temperature,
      });
      if (i > 0) {
        log.info({ tool: args.tool.name, attempt: a.label, maxTokens: a.maxTokens, temperature: a.temperature }, "generateStructuredWithRetry: recovered on retry");
      }
      return result as GenerateStructuredResult<unknown>;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const msg = lastErr.message;
      // 仅对"thinking 失控/截断"类错误重试；4xx 客户端错误立即抛出
      const isRetryable =
        /missing tool_use|max_tokens|Failed to parse streamed tool_use JSON/i.test(msg);
      // 4xx 客户端错误（401/403/422/429 等）重试也不会成功；其余错误立即抛出
      const isClientError = /\b(4\d\d)\b/.test(msg);
      if (!isRetryable || isClientError) {
        throw lastErr;
      }
      log.warn({
        tool: args.tool.name,
        attempt: a.label,
        error: msg.slice(0, 200),
        nextMaxTokens: attempts[i + 1]?.maxTokens,
        nextTemperature: attempts[i + 1]?.temperature,
      }, "generateStructuredWithRetry: failed, will retry with adjusted params");
    }
  }
  throw lastErr ?? new Error("generateStructuredWithRetry: exhausted attempts");
}

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
  createShare(params: {
    sessionId: string;
    school: string;
    major?: string;
    ending: Record<string, unknown>;
  }): Promise<string>;
  getShare(shareId: string): Promise<SimulatorShareRecord | null>;
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

  async advanceStep(sessionId: string, params: {
    newRound: number;
    historyEntry: SimulateHistoryEntry;
    nextScene: Record<string, unknown> | null;
    isFinal: boolean;
    ending?: Record<string, unknown>;
  }): Promise<void> {
    const current = this.sessions.get(sessionId);
    if (!current) throw new Error(`Session not found: ${sessionId}`);

    this.sessions.set(sessionId, {
      ...current,
      currentRound: params.newRound,
      status: params.isFinal ? "ended" : "playing",
      history: [...current.history, params.historyEntry],
      currentScene: params.nextScene as SimulateSession["currentScene"],
      ending: (params.ending ?? null) as SimulateSession["ending"],
      updatedAt: new Date().toISOString(),
    });
  }

  async markError(sessionId: string, error: string): Promise<void> {
    const current = this.sessions.get(sessionId);
    if (!current) return;

    this.sessions.set(sessionId, {
      ...current,
      status: "error",
      error,
      updatedAt: new Date().toISOString(),
    });
  }

  private shares = new Map<string, SimulatorShareRecord>();

  async createShare(params: {
    sessionId: string;
    school: string;
    major?: string;
    ending: Record<string, unknown>;
  }): Promise<string> {
    const id = `shr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const record: SimulatorShareRecord = {
      shareId: id,
      sessionId: params.sessionId,
      school: params.school,
      major: params.major,
      ending: params.ending,
      createdAt: new Date().toISOString(),
    };
    this.shares.set(id, record);
    return id;
  }

  async getShare(shareId: string): Promise<SimulatorShareRecord | null> {
    return this.shares.get(shareId) ?? null;
  }

  /** 直接写入/读取 session 对象（内存模式专用） */
  put(session: SimulateSession) { this.sessions.set(session.sessionId, session); }
  get(sessionId: string) { return this.sessions.get(sessionId); }
}

let repoInstance: ISimulatorRepo | MemorySimulatorRepo | null = null;
let repoInitPromise: Promise<ISimulatorRepo | MemorySimulatorRepo> | null = null;

async function getRepo(): Promise<ISimulatorRepo | MemorySimulatorRepo> {
  if (repoInstance) return repoInstance;
  if (repoInitPromise) return repoInitPromise;

  repoInitPromise = (async () => {
    try {
      const db = getPostgresPool();
      const pgRepo = new SimulatorPostgresRepository(db);

      // 先 await 建表（避免与 createShare 抢跑）
      try {
        await db.query(SIMULATOR_SCHEMA_SQL);
        log.info("Simulator tables ensured (simulator_sessions + simulator_shares)");
      } catch (err) {
        log.error({ err: String(err) }, "Failed to ensure simulator tables");
        throw err; // 让上层走内存降级
      }

      repoInstance = pgRepo;
      log.info("Using PostgreSQL repository for simulator");
      return pgRepo;
    } catch {
      // 无 DATABASE_URL / 建表失败 → 降级到内存
      repoInstance = new MemorySimulatorRepo();
      log.warn("Falling back to in-memory simulator storage (no DB or schema init failed)");
      return repoInstance;
    }
  })();

  return repoInitPromise;
}

// ── 类型守卫 ────────────────────────────────────────

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

function recoverStepResultFromSession(
  session: SimulateSession,
  choiceId: string,
  round: number,
): SimulateStepResult | null {
  const entry = session.history.at(-1);
  if (!entry || entry.choiceId !== choiceId || entry.round !== round) {
    return null;
  }

  const chosenChoice = {
    id: entry.choiceId,
    label: entry.choiceLabel,
  };
  const nextChoices = session.currentScene?.choices.filter((choice) => choice.id !== entry.choiceId) ?? [];
  const choices = [
    chosenChoice,
    nextChoices[0] ?? chosenChoice,
    nextChoices[1] ?? nextChoices[0] ?? chosenChoice,
  ] as SimulateStepResult["choices"];

  return {
    round: entry.round,
    scene_title: entry.scene_title,
    scene_description: entry.outcome_narrative,
    choices,
    outcome: {
      narrative: entry.outcome_narrative,
      effects: entry.outcome_effects,
    },
    is_final: session.status === "ended",
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
  const t0 = Date.now();
  const provider = getProvider(options);
  const totalRounds = input.totalRounds ?? 8;
  const repo = await getRepo();

  log.info({ school: input.profile.school, totalRounds }, "Creating simulator session");

  // 调用 LLM 生成第1轮场景
  const systemPrompt = buildSystemPrompt(input.profile, 1, totalRounds);
  const userPrompt = buildUserPromptForRound(input.profile, []);

  const { data: rawStep } = await generateStructuredWithRetry<typeof simulateStepTool>(provider, {
    system: systemPrompt,
    user: userPrompt,
    tool: simulateStepTool,
    temperature: 0.85,
    maxTokens: 12288,
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

  log.info({ sessionId, elapsed: Date.now() - t0 }, "Simulator session created with round 1");
  return session;
}

/** 提交选择 → 推演下一步 */
export async function handleSimulateStep(
  sessionId: string,
  choiceId: string,
  round: number,
  options: SimulatorServerOptions = {},
): Promise<{ session: SimulateSession; result: SimulateStepResult; ending?: SimulatorEnding }> {
  const t0 = Date.now();
  const repo = await getRepo();
  let session = await repo.getSession(sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const recoveredResult = recoverStepResultFromSession(session, choiceId, round);
  if (recoveredResult) {
    log.info({ sessionId, choiceId, round: recoveredResult.round }, "Returning idempotent simulator step");
    return {
      session,
      result: recoveredResult,
      ...(session.ending ? { ending: session.ending } : {}),
    };
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
  const userPrompt = buildUserPromptForRound(session.profile, session.history, chosenChoice.label, session.totalRounds);

  // 构建历史记录（在 LLM 调用前准备好）
  const historyEntry: SimulateHistoryEntry = {
    round: nextRound,
    scene_title: session.currentScene.scene_title,
    choiceId,
    choiceLabel: chosenChoice.label,
    outcome_narrative: "", // 稍后由 LLM 填充
    outcome_effects: [],   // 稍后由 LLM 填充
  };

  let ending: SimulatorEnding | null = null;
  let endingRaw: Record<string, unknown> | undefined;
  let stepResult: SimulateStepResult;

  if (isFinal) {
    // 最终轮：场景生成 + 结局生成 并行执行
    const updatedHistory = [...session.history, historyEntry];
    const endingPrompt = buildEndingPrompt(session.profile, updatedHistory);

    const [stepResultRaw, endingRawData] = await Promise.all([
      generateStructuredWithRetry<typeof simulateStepTool>(provider, {
        system: systemPrompt,
        user: userPrompt,
        tool: simulateStepTool,
        temperature: 0.85,
        maxTokens: 12288,
        timeoutMs: 60_000,
        traceId: sessionId,
      }),
      generateStructuredWithRetry<typeof generateEndingTool>(provider, {
        system: getEndingSystemPrompt(),
        user: endingPrompt,
        tool: generateEndingTool,
        temperature: 0.7,
        maxTokens: 12288,
        timeoutMs: 60_000,
        traceId: `${sessionId}:ending`,
      }),
    ]);

    // 更新 historyEntry 的 outcome 信息
    stepResult = normalizeStepResult(stepResultRaw.data, nextRound + 1, true);
    historyEntry.outcome_narrative = stepResult.outcome?.narrative || "";
    historyEntry.outcome_effects = stepResult.outcome?.effects || [];

    ending = endingRawData.data as unknown as SimulatorEnding;
    endingRaw = endingRawData.data as unknown as Record<string, unknown>;

    // 持久化到 DB（或内存）
    if ("advanceStep" in repo) {
      await repo.advanceStep(sessionId, {
        newRound: nextRound,
        historyEntry,
        nextScene: null, // 最终轮没有下一场景
        isFinal: true,
        ending: endingRaw,
      });
    } else {
      (repo as MemorySimulatorRepo).put({
        ...session,
        currentRound: nextRound,
        status: "ended",
        history: [...session.history, historyEntry],
        currentScene: null as unknown as SimulateSession["currentScene"],
        ending,
        updatedAt: new Date().toISOString(),
      });
    }
  } else {
    // 非最终轮：只生成场景
    const { data: rawStep } = await generateStructuredWithRetry<typeof simulateStepTool>(provider, {
      system: systemPrompt,
      user: userPrompt,
      tool: simulateStepTool,
      temperature: 0.85,
      maxTokens: 12288,
      timeoutMs: 60_000,
      traceId: sessionId,
    });

    stepResult = normalizeStepResult(rawStep, nextRound + 1, nextRound + 1 >= session.totalRounds);

    // 更新 historyEntry 的 outcome 信息
    historyEntry.outcome_narrative = stepResult.outcome?.narrative || "";
    historyEntry.outcome_effects = stepResult.outcome?.effects || [];

    // 持久化到 DB（或内存）
    const nextScene = {
      ...stepResult,
      round: nextRound + 1,
      is_final: nextRound + 1 >= session.totalRounds,
    };

    if ("advanceStep" in repo) {
      await repo.advanceStep(sessionId, {
        newRound: nextRound,
        historyEntry,
        nextScene,
        isFinal: false,
      });
    } else {
      (repo as MemorySimulatorRepo).put({
        ...session,
        currentRound: nextRound,
        status: "playing",
        history: [...session.history, historyEntry],
        currentScene: nextScene as unknown as SimulateSession["currentScene"],
        ending: null,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 读回最新状态
  session = await repo.getSession(sessionId);

  log.info({ sessionId, round: nextRound, isFinal, status: session?.status, elapsed: Date.now() - t0 }, "Step processed");

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
  const repo = await getRepo();
  const session = await repo.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  return session;
}

// ── 分享人设卡 ─────────────────────────────────────

/** 输入：来源 sessionId + ending；返回新生成的 shareId */
export async function handleCreateShare(params: {
  sessionId: string;
  school: string;
  major?: string;
  ending: Record<string, unknown>;
}): Promise<{ shareId: string }> {
  const repo = await getRepo();
  // 校验：源 session 必须存在，避免被任意人写入
  const session = await repo.getSession(params.sessionId);
  if (!session) {
    throw new Error(`Session not found: ${params.sessionId}`);
  }
  // 校验：ending 至少有 archetype 字段
  if (!params.ending || typeof params.ending !== "object" || !("archetype" in params.ending)) {
    throw new Error("Invalid ending payload: archetype is required");
  }
  const shareId = await repo.createShare({
    sessionId: params.sessionId,
    school: params.school,
    major: params.major,
    ending: params.ending,
  });
  log.info({ shareId, sessionId: params.sessionId }, "Share created");
  return { shareId };
}

/** 公开页：根据 shareId 获取 */
export async function handleGetShare(
  shareId: string,
): Promise<SimulatorShareRecord> {
  const repo = await getRepo();
  const share = await repo.getShare(shareId);
  if (!share) {
    throw new Error(`Share not found: ${shareId}`);
  }
  return share;
}

// ── 流式推演步骤 ─────────────────────────────────

/**
 * 流式推演步骤 — 返回 AsyncGenerator<StreamEvent>
 *
 * 通过 callback→generator 桥接模式消费 provider 的流式事件，
 * 中间事件（thinking/text）直接 yield 给 Route 层转发给前端，
 * 最终完成时 yield { type: "done", result }。
 */
export async function* handleSimulateStepStream(
  sessionId: string,
  choiceId: string,
  round: number,
  options: SimulatorServerOptions = {},
): AsyncGenerator<StreamEvent, void, undefined> {
  const t0 = Date.now();
  const repo = await getRepo();

  // ── 前置校验（与 handleSimulateStep 一致）────────
  let session = await repo.getSession(sessionId);
  if (!session) {
    yield { type: "error", error: `Session not found: ${sessionId}` };
    return;
  }

  const recoveredResult = recoverStepResultFromSession(session, choiceId, round);
  if (recoveredResult) {
    log.info({ sessionId, choiceId, round: recoveredResult.round }, "Returning idempotent simulator stream step");
    yield {
      type: "done",
      result: {
        session,
        result: recoveredResult,
        ...(session.ending ? { ending: session.ending } : {}),
      } as Record<string, unknown>,
    };
    return;
  }

  if (session.status !== "playing") {
    yield { type: "error", error: `Session is not playing: ${session.status}` };
    return;
  }
  if (!session.currentScene) {
    yield { type: "error", error: "No current scene available" };
    return;
  }

  const provider = getProvider(options);
  const nextRound = session.currentRound + 1;
  const isFinal = nextRound >= session.totalRounds;

  const chosenChoice = session.currentScene.choices.find((c) => c.id === choiceId);
  if (!chosenChoice) {
    yield { type: "error", error: `Invalid choiceId: ${choiceId}` };
    return;
  }

  log.info({ sessionId, choiceId, round: nextRound, isFinal }, "Processing simulator step (stream)");

  const systemPrompt = buildSystemPrompt(session.profile, nextRound + 1, session.totalRounds);
  const userPrompt = buildUserPromptForRound(session.profile, session.history, chosenChoice.label, session.totalRounds);

  const historyEntry: SimulateHistoryEntry = {
    round: nextRound,
    scene_title: session.currentScene.scene_title,
    choiceId,
    choiceLabel: chosenChoice.label,
    outcome_narrative: "",
    outcome_effects: [],
  };

  // ── callback → generator 桥接 ──────────────────────
  const eventQueue: StreamEvent[] = [];
  let resolveWaiter: (() => void) | null = null;
  let streamDone = false;
  // 用 as any 绕过 TS 对异步赋值的控制流收窄（while 循环后 TS 会错误地推断为 never）
  let streamError: Error | null = null as Error | null;
  let finalResult: GenerateStructuredResult<SimulateStepResult> | null = null as GenerateStructuredResult<SimulateStepResult> | null;

  const onEvent: StreamEventCallback = (event: StreamEvent): void => {
    eventQueue.push(event);
    if (resolveWaiter) {
      resolveWaiter();
      resolveWaiter = null;
    }
  };

  // 启动流式 LLM 调用（不 await，后台运行）
  const streamPromise = provider.generateStructuredStream<typeof simulateStepTool>({
    system: systemPrompt,
    user: userPrompt,
    tool: simulateStepTool,
    temperature: 0.85,
    maxTokens: 12288,
    timeoutMs: 60_000,
    traceId: sessionId,
    onEvent,
  }).then((result) => {
    finalResult = result as unknown as GenerateStructuredResult<SimulateStepResult>;
    streamDone = true;
    if (resolveWaiter) {
      resolveWaiter();
      resolveWaiter = null;
    }
  }).catch((err) => {
    streamError = err instanceof Error ? err : new Error(String(err));
    streamDone = true;
    if (resolveWaiter) {
      resolveWaiter();
      resolveWaiter = null;
    }
  });

  // ── 从队列中取出事件，yield 给消费者 ───────────
  try {
    while (!streamDone || eventQueue.length > 0) {
      if (eventQueue.length > 0) {
        const event = eventQueue.shift()!;

        // 过滤掉 provider 层的裸 done（只有 usage，没有 result）
        // server 层会在循环结束后构造带 result 的真正 done
        if (event.type === "done" && !("result" in event)) {
          continue;
        }

        yield event;
      } else if (!streamDone) {
        await new Promise<void>((resolve) => {
          resolveWaiter = resolve;
        });
      }
    }

    if (streamError) {
      const errMsg = streamError instanceof Error ? streamError.message : String(streamError);
      yield { type: "error", error: errMsg, fallback: true };
      return;
    }

    if (!finalResult) {
      yield { type: "error", error: "Stream ended without result", fallback: true };
      return;
    }

    // ── 最终轮：生成结局（非流式）───────────────────
    let ending: SimulatorEnding | null = null;
    let endingRaw: Record<string, unknown> | undefined;

    if (isFinal) {
      yield { type: "text_start", textContent: "" };
      yield { type: "text_delta", textContent: "正在生成你的大学人设卡..." };

      const updatedHistory = [...session.history, historyEntry];
      const endingPrompt = buildEndingPrompt(session.profile, updatedHistory);

      try {
        const endingResult = await generateStructuredWithRetry<typeof generateEndingTool>(provider, {
          system: getEndingSystemPrompt(),
          user: endingPrompt,
          tool: generateEndingTool,
          temperature: 0.7,
          maxTokens: 12288,
          timeoutMs: 60_000,
          traceId: `${sessionId}:ending`,
        });
        ending = endingResult.data as unknown as SimulatorEnding;
        endingRaw = endingResult.data as unknown as Record<string, unknown>;
      } catch (err) {
        log.error({ err: String(err) }, "Ending generation failed in stream mode");
      }
    }

    // ── normalize + 持久化 ─────────────────────────
    const stepResult = normalizeStepResult(finalResult.data, nextRound, isFinal);
    historyEntry.outcome_narrative = stepResult.outcome?.narrative || "";
    historyEntry.outcome_effects = stepResult.outcome?.effects || [];

    if (isFinal) {
      if ("advanceStep" in repo) {
        await repo.advanceStep(sessionId, {
          newRound: nextRound,
          historyEntry,
          nextScene: null,
          isFinal: true,
          ending: endingRaw,
        });
      } else {
        (repo as MemorySimulatorRepo).put({
          ...session,
          currentRound: nextRound,
          status: "ended",
          history: [...session.history, historyEntry],
          currentScene: null as unknown as SimulateSession["currentScene"],
          ending,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      const nextScene = {
        ...stepResult,
        round: nextRound + 1,
        is_final: nextRound + 1 >= session.totalRounds,
      };
      if ("advanceStep" in repo) {
        await repo.advanceStep(sessionId, {
          newRound: nextRound,
          historyEntry,
          nextScene,
          isFinal: false,
        });
      } else {
        (repo as MemorySimulatorRepo).put({
          ...session,
          currentRound: nextRound,
          status: "playing",
          history: [...session.history, historyEntry],
          currentScene: nextScene as unknown as SimulateSession["currentScene"],
          ending: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // 读回最新状态
    session = await repo.getSession(sessionId);

    // ── yield 最终结果 ─────────────────────────────
    yield {
      type: "done",
      result: {
        session: session!,
        result: {
          ...stepResult,
          round: nextRound,
          is_final: isFinal,
        },
        ...(ending ? { ending } : {}),
      } as Record<string, unknown>,
      usage: {
        inputTokens: finalResult.usage.inputTokens ?? 0,
        outputTokens: finalResult.usage.outputTokens ?? 0,
      },
    };

    log.info({ sessionId, round: nextRound, isFinal, elapsed: Date.now() - t0 }, "Stream step completed");
  } catch (err) {
    yield {
      type: "error",
      error: err instanceof Error ? err.message : "Stream processing failed",
      fallback: true,
    };
  } finally {
    // 确保即使 generator 被取消，stream promise 也不会泄漏
    void streamPromise;
  }
}
