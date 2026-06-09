"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FutureShell } from "../../future/FutureShell";
import { GameCard } from "./GameCard";
import { ResultPanel } from "./ResultPanel";
import { HistorySidebar } from "./HistorySidebar";
import { EndingScreen } from "./EndingScreen";
import { ThinkingPanel, type StreamPhase } from "./ThinkingPanel";
import { getSimulatorSession, simulateStep, simulateStepStream } from "@/lib/future/simulator-client";
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
      <div className="flex flex-col items-center justify-center py-20 gap-5">
        {/* 品牌化加载动画 */}
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/25 opacity-60" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 text-lg shadow-[0_8px_24px_-12px_rgba(63,143,155,0.3)]">
            🎓
          </span>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-medium text-text-secondary">正在准备你的大学生活</p>
          <p className="text-xs text-text-muted animate-pulse">正在连接 AI 叙事引擎…</p>
        </div>
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
  const [pendingEnding, setPendingEnding] = useState<SimulatorEnding | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStartTime, setLoadingStartTime] = useState<number>(0);
  const [loadingRound, setLoadingRound] = useState<number>(1);

  // ── 流式状态 ──
  const [streamPhase, setStreamPhase] = useState<StreamPhase>("waiting");
  const [thinkingTokens, setThinkingTokens] = useState<number>(0);
  const [streamNarrative, setStreamNarrative] = useState<string>("");

  // 加载或恢复会话
  useEffect(() => {
    if (!sessionId) {
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
    setLoadingStartTime(Date.now());
    setLoadingRound((session?.currentRound ?? session?.history.length ?? 0) + 1);

    // 重置流式状态
    setStreamPhase("waiting");
    setThinkingTokens(0);
    setStreamNarrative("");

    try {
      // ── 优先尝试流式调用 ──
      const streamOk = await simulateStepStream(sessionId, choiceId, {
        onThinkingStart: () => setStreamPhase("thinking"),
        onThinkingDelta: (tokens) => {
          setThinkingTokens(tokens);
          setStreamPhase("thinking");
        },
        onTextDelta: (fullText) => {
          setStreamNarrative(fullText);
          setStreamPhase("narrating");
        },
        onToolUseStart: () => setStreamPhase("generating"),
        onDone: (data) => {
          setStreamPhase("complete");
          setSession(data.session);
          setLastResult(data.result);

          if (data.ending) {
            // 最终轮：不自动跳转结局，先展示结果让用户消化
            // 结局数据存入 pendingEnding，等用户主动触发揭幕
            setPendingEnding(data.ending);
            setPhase("result");
          } else {
            setPhase("result");
          }
        },
        onError: (_error, canFallback) => {
          console.warn("[simulator] Stream error:", _error, "fallback:", canFallback);
        },
      });

      // 流式失败 → 自动降级到非流式
      if (!streamOk) {
        console.info("[simulator] Stream failed, falling back to non-streaming");
        const { session: updatedSession, result, ending: endingData } = await simulateStep(sessionId, choiceId);

        setSession(updatedSession);
        setLastResult(result);

        if (endingData) {
          setPendingEnding(endingData);
          setPhase("result");
        } else {
          setPhase("result");
        }
      }
    } catch (err) {
      console.error("[simulator] Step failed:", err);
      setError(err instanceof Error ? err.message : "推演失败");
      setPhase("error");
    }
  }, [session, sessionId]);

  // 用户手动确认：普通轮次进入下一轮选择
  const handleContinue = useCallback(() => {
    setLastResult(null);
    setPhase("choosing");
  }, []);

  // 最终轮：用户触发结局揭幕（带仪式感动画）
  const handleRevealEnding = useCallback(() => {
    if (!pendingEnding) return;
    setIsRevealing(true);
    // 短暂的"揭幕前奏"：ResultPanel 收起 → 停顿 → EndingScreen 展开
    setTimeout(() => {
      setEnding(pendingEnding);
      setPendingEnding(null);
      setIsRevealing(false);
      setPhase("ending");
    }, 800);
  }, [pendingEnding]);

  // 重新开始
  const handleRestart = useCallback(() => {
    router.push("/simulator");
  }, [router]);

  // 返回首页
  const handleBack = useCallback(() => {
    router.push("/");
  }, [router]);

  // ── 初始加载会话时（session 还没拿到），显示全屏 loading ──

  if (phase === "loading" && !session) {
    return (
      <FutureShell title="大学人生模拟器" backHref="/simulator" backLabel="重新设定">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative h-12 w-12">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/30 opacity-75" />
            <span className="relative inset-0 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-mono">
              AI
            </span>
          </div>
          <p className="text-sm text-text-muted animate-pulse">
            正在加载游戏…
          </p>
        </div>
      </FutureShell>
    );
  }

  // ── Error ────────────────────────────────────────

  if (!sessionId || phase === "error") {
    const isSessionLost = error?.includes("Session not found");
    return (
      <FutureShell title="大学人生模拟器" backHref="/simulator" backLabel="重新开始">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-4xl">🎮</div>
          <p className="text-sm text-text-secondary text-center max-w-xs leading-relaxed">
            {!sessionId
              ? "缺少游戏会话，请重新开始一局。"
              : isSessionLost
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

  // ── 主界面：左右分栏布局（历史栏常驻） ──────────

  return (
    <FutureShell
      title={session?.profile.school ? `${session.profile.school} · 人生模拟` : "大学人生模拟器"}
      backHref="/simulator"
      backLabel="退出"
      mainClassName="pb-8"
      contentMaxClassName="max-w-[1680px]"
    >
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ── 左侧：历史记录侧边栏（任何阶段都可见） ─── */}
        {session && (
          <HistorySidebar
            session={session}
            currentResult={lastResult}
            currentPhase={phase}
            loadingRound={loadingRound}
          />
        )}

        {/* ── 右侧：主内容区 ────────────────────────── */}
        <div className="min-w-0">
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
                  isFirstRound={session.currentRound === 1 && session.history.length === 0}
                  onSelect={handleSelect}
                />
              </motion.div>
            )}

            {/* AI 思考中 — 右侧展示动画面板，左侧历史栏保持可见 */}
            {phase === "loading" && session && (
              <ThinkingPanel
                startTime={loadingStartTime}
                currentRound={loadingRound}
                totalRounds={session.totalRounds}
                streamPhase={streamPhase}
                thinkingTokens={thinkingTokens}
                narrativeText={streamNarrative}
              />
            )}

            {phase === "result" && lastResult && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={isRevealing ? { opacity: 0, scale: 0.95, y: -8 } : { opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: isRevealing ? 0.5 : 0.3, ease: isRevealing ? "easeIn" : "easeOut" }}
              >
                <ResultPanel
                  result={lastResult}
                  onContinue={handleContinue}
                  isFinalRound={!!pendingEnding}
                  onRevealEnding={handleRevealEnding}
                />
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
