/**
 * 大学人生模拟器 — 前端 API 客户端
 */

import type {
  SimulateStartInput,
  SimulateSession,
  SimulateStepResult,
  SimulatorEnding,
} from "./simulator-types";

export class SimulatorApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimulatorApiError";
  }
}

const DEV = process.env.NODE_ENV === "development";
const clog = {
  debug: (...args: unknown[]) => { if (DEV) console.debug("[simulator:client]", ...args); },
  info:  (...args: unknown[]) => { if (DEV) console.info("[simulator:client]", ...args); },
  warn:  (...args: unknown[]) => console.warn("[simulator:client]", ...args),
  error: (...args: unknown[]) => console.error("[simulator:client]", ...args),
};

function apiUrl(path: string) {
  // 优先使用独立 Node.js 服务地址（通过 SIMULATOR_API_URL 配置）
  const baseUrl = process.env.NEXT_PUBLIC_SIMULATOR_API_URL;
  if (baseUrl) {
    return `${baseUrl.replace(/\/+$/, "")}${path}`;
  }
  // 未配置时回退到 Next.js API Routes
  return path;
}

/** 创建游戏会话 + 初始化第1轮场景 */
export async function createSimulatorSession(input: SimulateStartInput): Promise<SimulateSession> {
  clog.info("POST /api/simulator", { school: input.profile.school, rounds: input.totalRounds ?? 8 });
  const res = await fetch(apiUrl("/api/simulator"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errText = await res.text();
    clog.warn("POST /api/simulator failed", { status: res.status, error: errText.slice(0, 200) });
    throw new SimulatorApiError(errText);
  }

  const data = (await res.json()) as SimulateSession;
  clog.info("POST /api/simulator ok", { sessionId: data.sessionId, status: data.status });
  return data;
}

/** 提交选择 → LLM 推演下一步 */
export async function simulateStep(
  sessionId: string,
  choiceId: string,
  round: number,
): Promise<{ session: SimulateSession; result: SimulateStepResult; ending?: SimulatorEnding }> {
  clog.debug("POST /api/simulator/:sessionId", { sessionId, choiceId, round });
  const res = await fetch(apiUrl(`/api/simulator/${encodeURIComponent(sessionId)}`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ choiceId, round }),
  });

  if (!res.ok) {
    const errText = await res.text();
    clog.warn("POST step failed", { status: res.status, error: errText.slice(0, 200) });
    throw new SimulatorApiError(errText);
  }

  const data = (await res.json()) as { session: SimulateSession; result: SimulateStepResult; ending?: SimulatorEnding };
  return data;
}

/** 获取会话状态（用于恢复中断的游戏） */
export async function getSimulatorSession(sessionId: string): Promise<SimulateSession> {
  const res = await fetch(apiUrl(`/api/simulator/${encodeURIComponent(sessionId)}`));
  if (!res.ok) {
    throw new SimulatorApiError(await res.text());
  }
  return res.json() as Promise<SimulateSession>;
}

export function recoverStepResultFromSession(
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

// ── 流式调用 ──────────────────────────────────────

/** 流式推演步骤的回调接口 */
export interface SimulateStepStreamCallbacks {
  /** 收到 thinking_start 事件 */
  onThinkingStart?: () => void;
  /** 收到 thinking_delta 事件 */
  onThinkingDelta?: (tokens: number) => void;
  /** 收到 text_delta 事件（叙述性文字增量） */
  onTextDelta?: (fullText: string) => void;
  /** 收到 tool_use_start 事件（即将返回 JSON） */
  onToolUseStart?: () => void;
  /** 流完成，收到最终结果 */
  onDone: (result: { session: SimulateSession; result: SimulateStepResult; ending?: SimulatorEnding }) => void;
  /** 流出错 */
  onError?: (error: string, canFallback: boolean) => void;
}

/**
 * 流式提交选择 → 消费 SSE 流
 *
 * @returns true=流式成功完成, false=失败(需降级到非流式)
 */
export async function simulateStepStream(
  sessionId: string,
  choiceId: string,
  round: number,
  callbacks: SimulateStepStreamCallbacks,
): Promise<boolean> {
  clog.debug("POST /api/simulator/:sessionId (stream)", { sessionId, choiceId, round });

  try {
    const res = await fetch(
      apiUrl(`/api/simulator/${encodeURIComponent(sessionId)}?stream=true`),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ choiceId, round }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      clog.warn("POST stream failed (HTTP)", { status: res.status, error: errText.slice(0, 200) });
      callbacks.onError?.(errText, true);
      return false;
    }

    // 检查响应是否真的是 SSE（服务端可能降级到非流式）
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      clog.warn("Response is not SSE, falling back to JSON parse");
      try {
        const data = (await res.json()) as {
          session: SimulateSession;
          result: SimulateStepResult;
          ending?: SimulatorEnding;
        };
        callbacks.onDone(data);
        return true;
      } catch {
        callbacks.onError?.("Failed to parse non-stream response", true);
        return false;
      }
    }

    // 消费 SSE 流
    const body = res.body;
    if (!body) {
      callbacks.onError?.("Response body is null", true);
      return false;
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedFinalResult = false;

    const processLine = (line: string): boolean => {
      if (!line.startsWith("data: ")) return false;
      const dataStr = line.slice(6).trim();
      if (!dataStr || dataStr === "[DONE]") return false;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(dataStr);
      } catch {
        return false;
      }

      switch (event.type) {
        case "thinking_start":
          callbacks.onThinkingStart?.();
          break;
        case "thinking_delta":
          callbacks.onThinkingDelta?.((event.thinkingTokens as number) ?? 0);
          break;
        case "text_start":
          break;
        case "text_delta":
          callbacks.onTextDelta?.((event.textContent as string) ?? "");
          break;
        case "tool_use_start":
          callbacks.onToolUseStart?.();
          break;
        case "done":
          if (event.result) {
            receivedFinalResult = true;
            callbacks.onDone(event.result as {
              session: SimulateSession;
              result: SimulateStepResult;
              ending?: SimulatorEnding;
            });
            return true;
          }
          break;
        case "error":
          callbacks.onError?.(
            (event.error as string) ?? "Unknown stream error",
            (event.fallback as boolean) ?? false,
          );
          return true;
      }

      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (processLine(line)) {
          if (receivedFinalResult) {
            return true;
          }
          if (!receivedFinalResult) {
            return false;
          }
        }
      }
    }

    buffer += decoder.decode();
    for (const line of buffer.split("\n")) {
      if (processLine(line)) {
        return receivedFinalResult;
      }
    }

    // 正常读完流但没有收到 done 事件
    clog.warn("Stream ended without final result", { receivedFinalResult });
    callbacks.onError?.("Stream ended without final result", true);
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    clog.error("POST stream exception", { error: msg });
    callbacks.onError?.(msg, true);
    return false;
  }
}
