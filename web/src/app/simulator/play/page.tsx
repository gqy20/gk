"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FutureShell } from "../../future/FutureShell";
import { GameCard } from "./GameCard";
import { ResultPanel } from "./ResultPanel";
import { HistorySidebar } from "./HistorySidebar";
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

/** 结果展示后自动过渡到下一轮的延迟（ms） */
const AUTO_ADVANCE_DELAY = 2200;

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
          setPhase("ending");
          setEnding(data.ending);
        } else if (data.currentScene) {
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
        // 游戏结束 → 稍作延迟展示结局（让用户先看到最后一轮结果）
        setEnding(endingData);
        setTimeout(() => setPhase("ending"), 1200);
      } else {
        // 有结果 → 先展示结果，然后自动过渡到下一轮选择
        setPhase("result");
        setTimeout(() => {
          setLastResult(null);
          setPhase("choosing");
        }, AUTO_ADVANCE_DELAY);
      }
    } catch (err) {
      console.error("[simulator] Step failed:", err);
      setError(err instanceof Error ? err.message : "推演失败");
      setPhase("error");
    }
  }, [session, sessionId]);

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

  // ── 主界面：左右分栏布局 ───────────────────────

  return (
    <FutureShell
      title={session?.profile.school ? `${session.profile.school} · 人生模拟` : "大学人生模拟器"}
      backHref="/simulator"
      backLabel="退出"
      mainClassName="pb-8"
    >
      <div className="flex gap-5">
        {/* ── 左侧：历史记录侧边栏 ──────────── */}
        {session && (
          <HistorySidebar
            session={session}
            currentResult={lastResult}
            currentPhase={phase}
          />
        )}

        {/* ── 右侧：主内容区 ───────────────── */}
        <div className="min-w-0 flex-1">
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
              >
                <ResultPanel result={lastResult} />
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
      </div>
    </FutureShell>
  );
}
