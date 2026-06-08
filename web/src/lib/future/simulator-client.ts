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
): Promise<{ session: SimulateSession; result: SimulateStepResult; ending?: SimulatorEnding }> {
  clog.debug("POST /api/simulator/:sessionId", { sessionId, choiceId });
  const res = await fetch(apiUrl(`/api/simulator/${encodeURIComponent(sessionId)}`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ choiceId }),
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
