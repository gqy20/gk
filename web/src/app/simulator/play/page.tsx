"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FutureShell } from "../../future/FutureShell";
import { GameCard } from "./GameCard";
import { ResultPanel } from "./ResultPanel";
import { ProgressBar } from "./ProgressBar";
import { EndingScreen } from "./EndingScreen";
import { getSimulatorSession, simulateStep } from "@/lib/future/simulator-client";
import type { SimulateSession, SimulateStepResult, SimulatorEnding } from "@/lib/future/simulator-types";

export default function SimulatorPlayPage() {
  return (
    <Suspense fallback={<PlayShell />}>
      <PlayContent />
    </Suspense>
  );
}

function PlayShell() {
  return (
    <FutureShell title="大学人生模拟器" backHref="/simulator" backLabel="重新设定">
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-text-muted">正在加载游戏…</div>
      </div>
    </FutureShell>
  );
}

type Phase = "loading" | "choosing" | "result" | "ending" | "error";

function PlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";

  // 游戏状态
  const [session, setSession] = useState<SimulateSession | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [lastResult, setLastResult] = useState<SimulateStepResult | null>(null);
  const [ending, setEnding] = useState<SimulatorEnding | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 加载或恢复会话
  useEffect(() => {
    if (!sessionId) {
      setError("缺少 sessionId");
      setPhase("error");
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const data = await getSimulatorSession(sessionId);
        if (cancelled) return;
        setSession(data);

        if (data.status === "ended") {
          // 已结束的游戏，直接展示结局
          setPhase("ending");
          setEnding(data.ending);
        } else if (data.currentScene) {
          // 有当前场景 → 选择阶段
          setPhase("choosing");
        } else {
          setError("游戏状态异常");
          setPhase("error");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[simulator] Failed to load session:", err);
        setError(err instanceof Error ? err.message : "加载游戏失败");
        setPhase("error");
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  // 处理选择
  const handleSelect = useCallback(async (choiceId: string) => {
    if (!session || !sessionId) return;

    setPhase("loading");

    try {
      const { session: updatedSession, result, ending: endingData } = await simulateStep(sessionId, choiceId);

      setSession(updatedSession);
      setLastResult(result);

      if (endingData) {
        // 游戏结束
        setEnding(endingData);
        setTimeout(() => setPhase("ending"), 800); // 先展示结果再切结局
      } else {
        setPhase("result");
      }
    } catch (err) {
      console.error("[simulator] Step failed:", err);
      setError(err instanceof Error ? err.message : "推演失败");
      setPhase("error");
    }
  }, [session, sessionId]);

  // 从结果进入下一轮选择
  const handleNextRound = useCallback(() => {
    if (!session) return;
    setLastResult(null);
    setPhase("choosing");
  }, [session]);

  // 回退到某一步（MVP 简化版：只支持 UI 层回退提示）
  const handleUndo = useCallback((round: number) => {
    // MVP 不实现真正的服务端回退，仅给用户反馈
    console.log(`[simulator] Undo requested for round ${round} — not implemented in MVP`);
  }, []);

  // 重新开始
  const handleRestart = useCallback(() => {
    router.push("/simulator");
  }, [router]);

  // 返回首页
  const handleBack = useCallback(() => {
    router.push("/");
  }, [router]);

  // ── Loading ──────────────────────────────────────

  if (phase === "loading") {
    return (
      <FutureShell title="大学人生模拟器" backHref="/simulator" backLabel="重新设定">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          {/* 圆形脉冲动画 */}
          <div className="relative h-12 w-12">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/30 opacity-75" />
            <span className="relative inset-0 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-mono">
              AI
            </span>
          </div>
          <p className="text-sm text-text-muted animate-pulse">
            正在推演你的选择…
          </p>
        </div>
      </FutureShell>
    );
  }

  // ── Error ────────────────────────────────────────

  if (phase === "error") {
    const isSessionLost = error?.includes("Session not found");
    return (
      <FutureShell title="大学人生模拟器" backHref="/simulator" backLabel="重新开始">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-4xl">🎮</div>
          <p className="text-sm text-text-secondary text-center max-w-xs leading-relaxed">
            {isSessionLost
              ? "游戏会话已过期（可能服务器重启了）。别担心，重新开始一局就好！"
              : (error || "发生了错误")}
          </p>
          <button
            type="button"
            onClick={handleRestart}
            className="rounded-xl border border-accent/30 bg-accent/8 px-6 py-2.5 text-sm font-medium text-accent transition hover:border-accent/50 hover:bg-accent/15"
          >
            开始新的一局
          </button>
        </div>
      </FutureShell>
    );
  }

  // ── 主界面 ───────────────────────────────────────

  return (
    <FutureShell
      title={session?.profile.school ? `${session.profile.school} · 人生模拟` : "大学人生模拟器"}
      backHref="/simulator"
      backLabel="退出"
      mainClassName="pb-8"
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {/* 进度条 + 历史时间轴 */}
        {session && (
          <ProgressBar session={session} onUndo={handleUndo} />
        )}

        {/* 动态内容区 */}
        <AnimatePresence mode="wait">
          {phase === "choosing" && session?.currentScene && (
            <motion.div
              key={`round-${session.currentScene.round}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <GameCard
                scene={session.currentScene}
                currentRound={session.currentRound}
                totalRounds={session.totalRounds}
                onSelect={handleSelect}
              />
            </motion.div>
          )}

          {phase === "result" && lastResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <ResultPanel result={lastResult} />

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleNextRound}
                  className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/8 px-6 py-2.5 text-sm font-medium text-accent transition hover:border-accent/50 hover:bg-accent/15"
                >
                  继续下一步
                  <span aria-hidden>→</span>
                </button>
              </div>
            </motion.div>
          )}

          {phase === "ending" && ending && session && (
            <motion.div
              key="ending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <EndingScreen
                ending={ending}
                history={session.history}
                school={session.profile.school}
                onRestart={handleRestart}
                onBack={handleBack}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FutureShell>
  );
}
