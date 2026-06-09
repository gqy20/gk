/**
 * 大学人生模拟器 — 服务端逻辑
 *
 * 优先使用 PostgreSQL（Neon）持久化会话，
 * 无 DATABASE_URL 时降级为内存存储。
 */

import { AnthropicProvider, type StreamEvent, type StreamEventCallback } from "./anthropic";
import type { GenerateStructuredResult } from "./anthropic";
import { getPostgresPool } from "./pg-client";
import { SimulatorPostgresRepository, SIMULATOR_SCHEMA_SQL } from "./simulator-repository";
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

  async advanceStep(_sessionId: string, _params: {
    newRound: number;
    historyEntry: SimulateHistoryEntry;
    nextScene: Record<string, unknown> | null;
    isFinal: boolean;
    ending?: Record<string, unknown>;
  }): Promise<void> {}

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
  options: SimulatorServerOptions = {},
): Promise<{ session: SimulateSession; result: SimulateStepResult; ending?: SimulatorEnding }> {
  const t0 = Date.now();
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
      provider.generateStructured<typeof simulateStepTool>({
        system: systemPrompt,
        user: userPrompt,
        tool: simulateStepTool,
        temperature: 0.85,
        maxTokens: 12288,
        timeoutMs: 60_000,
        traceId: sessionId,
      }),
      provider.generateStructured<typeof generateEndingTool>({
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
    const { data: rawStep } = await provider.generateStructured<typeof simulateStepTool>({
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
  const repo = getRepo();
  const session = await repo.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  return session;
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
  options: SimulatorServerOptions = {},
): AsyncGenerator<StreamEvent, void, undefined> {
  const t0 = Date.now();
  const repo = getRepo();

  // ── 前置校验（与 handleSimulateStep 一致）────────
  let session = await repo.getSession(sessionId);
  if (!session) {
    yield { type: "error", error: `Session not found: ${sessionId}` };
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
  const userPrompt = buildUserPromptForRound(session.profile, session.history, chosenChoice.label);

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
        const endingResult = await provider.generateStructured<typeof generateEndingTool>({
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

