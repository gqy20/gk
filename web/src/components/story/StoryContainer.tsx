"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { School, ProvinceData } from "@/lib/data";
import ChinaMap3D, {
  type ChinaMap3DHandle,
} from "@/components/ChinaMap3D";
import {
  interpolateCameraTarget,
  getVisibleTiers,
  STORY_PHASES,
  type TierName,
} from "@/lib/animation/story-keyframes";

interface StoryContainerProps {
  schools: School[];
  provinces: ProvinceData[];
  onComplete: () => void;
}

/** Story mode 下不需要的回调（空操作） */
const noop = () => {};
const PHASE_STEP = STORY_PHASES.length > 1 ? 1 / (STORY_PHASES.length - 1) : 1;

export default function StoryContainer({
  schools,
  provinces,
  onComplete,
}: StoryContainerProps) {
  const pinRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ChinaMap3DHandle>(null);
  const completedRef = useRef(false);
  const wheelDeltaRef = useRef(0);
  const shellRef = useRef<HTMLDivElement>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const storyProgress = phaseIndex * PHASE_STEP;

  useEffect(() => {
    shellRef.current?.focus({ preventScroll: true });
  }, []);

  const completeStory = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  // 根据进度计算相机目标
  const cameraTarget = useMemo(() => interpolateCameraTarget(storyProgress), [storyProgress]);
  // 根据进度计算可见层级
  const visibleTiers: TierName[] = useMemo(() => getVisibleTiers(storyProgress), [storyProgress]);

  const handleSkip = useCallback(() => {
    completeStory();
  }, [completeStory]);

  const stepPhase = useCallback((direction: 1 | -1) => {
    setPhaseIndex((current) => {
      const next = Math.min(STORY_PHASES.length - 1, Math.max(0, current + direction));
      return next;
    });
  }, []);

  const handlePhaseJump = useCallback((index: number) => {
    if (!STORY_PHASES[index]) return;
    setPhaseIndex(index);
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    wheelDeltaRef.current += event.deltaY;
    if (Math.abs(wheelDeltaRef.current) < 80) return;
    stepPhase(wheelDeltaRef.current > 0 ? 1 : -1);
    wheelDeltaRef.current = 0;
  }, [stepPhase]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    shell.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      shell.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      stepPhase(1);
    }
    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      stepPhase(-1);
    }
  }, [stepPhase]);

  const activePhase = STORY_PHASES[phaseIndex] ?? STORY_PHASES[0];
  const progressPercent = Math.round(storyProgress * 100);
  const displayedTiers = [
    { key: "985", label: "985", visible: visibleTiers.includes("985") },
    { key: "211", label: "211", visible: visibleTiers.includes("211") },
    { key: "doubleFirst", label: "双一流", visible: visibleTiers.includes("doubleFirst") },
    { key: "normal", label: "普通高校", visible: visibleTiers.includes("normal") },
  ];

  return (
    <div ref={pinRef} data-story-root>
      <div
        ref={shellRef}
        className="story-shell"
        role="region"
        aria-label="高校地图介绍"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className="story-map-layer" aria-hidden="true">
          <ChinaMap3D
            ref={mapRef}
            schools={schools}
            highlightedSchools={schools}
            provinces={provinces}
            selectedProvince={null}
            previewSchool={null}
            hasActiveMapFilters={false}
            filter985={false}
            filter211={false}
            filterDoubleFirst={false}
            onProvinceSelect={noop}
            onSchoolPreview={noop}
            onSchoolClick={noop}
            onToggle985={noop}
            onToggle211={noop}
            onToggleDoubleFirst={noop}
            storyMode
            storyProgress={storyProgress}
            storyCameraTarget={cameraTarget}
            visibleTiers={visibleTiers}
          />
        </div>

        <div className="story-vignette" aria-hidden="true" />
        <div className="story-grid-lines" aria-hidden="true" />

        <header className="story-topbar">
          <div className="story-brand" aria-label="中国高校信息地图">
            <span className="story-brand-mark" aria-hidden="true" />
            <span>中国高校信息地图</span>
          </div>
          <button type="button" onClick={handleSkip} className="story-skip-btn">
            跳过介绍
          </button>
        </header>

        <nav className="story-side-nav" aria-label="介绍章节">
          {STORY_PHASES.map((phase, index) => {
            const active = index === phaseIndex;
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => handlePhaseJump(index)}
                className={active ? "is-active" : ""}
                aria-current={active ? "step" : undefined}
              >
                <span className="story-nav-dot" aria-hidden="true" />
                <span>{phase.navLabel}</span>
              </button>
            );
          })}
        </nav>

        <main className="story-copy-panel" aria-live="polite">
          <div className="story-phase-meta">
            <span>{activePhase.label}</span>
            <span>{activePhase.metric}</span>
          </div>
          <h1 className="story-title" key={`${activePhase.id}-title`}>
            {activePhase.title}
          </h1>
          <p className="story-desc" key={`${activePhase.id}-desc`}>
            {activePhase.description}
          </p>

          <div className="story-tier-row" aria-label="当前点亮的学校层级">
            {displayedTiers.map((tier) => (
              <span key={tier.key} className={tier.visible ? "is-visible" : ""}>
                {tier.label}
              </span>
            ))}
          </div>

          <div className="story-actions">
            <button type="button" onClick={completeStory} className="story-primary-action">
              {activePhase.actionLabel ?? "进入地图探索"}
            </button>
            <button
              type="button"
              onClick={() => stepPhase(phaseIndex === STORY_PHASES.length - 1 ? -1 : 1)}
              className="story-step-action"
            >
              {phaseIndex === STORY_PHASES.length - 1 ? "返回上一段" : "下一段"}
            </button>
            <span className="story-scroll-hint">滚轮或方向键切换视角</span>
          </div>
        </main>

        <footer className="story-footer">
          <div className="story-progress-track" aria-label={`介绍进度 ${progressPercent}%`}>
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <span>{String(phaseIndex + 1).padStart(2, "0")} / {String(STORY_PHASES.length).padStart(2, "0")}</span>
        </footer>
      </div>
    </div>
  );
}
