"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { School, ProvinceData } from "@/lib/data";
import ChinaMap3D, {
  type ChinaMap3DHandle,
} from "@/components/ChinaMap3D";
import { useScrollProgress } from "@/lib/animation/useScrollProgress";
import {
  interpolateCameraTarget,
  getVisibleTiers,
  getPhaseInfo,
  STORY_PHASES,
  type TierName,
} from "@/lib/animation/story-keyframes";
import Phase1Hero from "./Phase1Hero";
import Phase2Layers from "./Phase2Layers";
import Phase3Features from "./Phase3Features";
import Phase4CTA from "./Phase4CTA";

interface StoryContainerProps {
  schools: School[];
  provinces: ProvinceData[];
  onComplete: () => void;
}

/** Story mode 下不需要的回调（空操作） */
const noop = () => {};

export default function StoryContainer({
  schools,
  provinces,
  onComplete,
}: StoryContainerProps) {
  const pinRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ChinaMap3DHandle>(null);
  const [progress, setProgress] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);

  // 滚动进度驱动
  const scrollProgress = useScrollProgress({
    pinRef,
    scrubHeight: 5000,
    onProgress: (p) => {
      setProgress(p);
      const info = getPhaseInfo(p);
      setPhaseIndex(info.phaseIndex);
      setPhaseProgress(info.phaseProgress);
    },
    onComplete,
  });

  // 根据进度计算相机目标
  const cameraTarget = interpolateCameraTarget(scrollProgress);
  // 根据进度计算可见层级
  const visibleTiers: TierName[] = getVisibleTiers(scrollProgress);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  return (
    <div ref={pinRef} data-story-root className="relative">
      {/* ── 地图层（固定背景）── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="h-full w-full">
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
            storyProgress={scrollProgress}
            storyCameraTarget={cameraTarget}
            visibleTiers={visibleTiers}
          />
        </div>
      </div>

      {/* ── 跳过按钮（固定右上角）── */}
      <button
        type="button"
        onClick={handleSkip}
        className="story-skip-btn fixed right-4 top-4 z-50 cursor-pointer rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/35 hover:text-white"
        aria-label="跳过介绍"
      >
        跳过 →
      </button>

      {/* ── 内容层（滚动前景）── */}
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          <section data-story-phase="hero" aria-label="开场">
            <Phase1Hero progress={progress} />
          </section>

          <section data-story-phase="layers" aria-label="分层展示">
            <Phase2Layers
              phaseProgress={phaseProgress}
              active={phaseIndex >= 1}
              visibleTiers={visibleTiers}
            />
          </section>

          <section data-story-phase="features" aria-label="功能预览">
            <Phase3Features
              phaseProgress={phaseProgress}
              active={phaseIndex >= 2}
            />
          </section>

          <section data-story-phase="cta" aria-label="行动召唤">
            <Phase4CTA
              phaseProgress={phaseProgress}
              active={phaseIndex >= 3}
              onEnter={onComplete}
              currentPhase={phaseIndex}
              totalPhases={STORY_PHASES.length}
            />
          </section>
        </AnimatePresence>

        {/* 滚动空间填充 */}
        <div className="h-[60vh]" aria-hidden="true" />
      </div>
    </div>
  );
}
