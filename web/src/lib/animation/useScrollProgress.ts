"use client";

import { useEffect, useRef, useState } from "react";
import { registerScrollTrigger } from "./gsap";

interface UseScrollProgressOptions {
  /** ScrollTrigger 要 pin 的容器元素 */
  pinRef: React.RefObject<HTMLElement | null>;
  /** 滚动总高度（像素），默认 5000（约 5 个视口高度） */
  scrubHeight?: number;
  /** 每次进度更新时回调 (0..1) */
  onProgress?: (progress: number) => void;
  /** 滚动到达末端时回调 */
  onComplete?: () => void;
  /** 是否禁用（直接返回 progress=1） */
  disabled?: boolean;
}

/**
 * 基于 GSAP ScrollTrigger 的滚动进度 Hook。
 *
 * 创建一个 pinned 的滚动容器，将滚动距离映射为 0..1 的 progress 值。
 * 适用于滚动驱动叙事、相机动画等场景。
 */
export function useScrollProgress({
  pinRef,
  scrubHeight = 5000,
  onProgress,
  onComplete,
  disabled = false,
}: UseScrollProgressOptions): number {
  const [progress, setProgress] = useState(0);
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (disabled || !pinRef.current) {
      setProgress(1);
      onComplete?.();
      return;
    }

    const ScrollTrigger = registerScrollTrigger();
    if (!ScrollTrigger) {
      setProgress(1);
      onComplete?.();
      return;
    }

    const el = pinRef.current;
    if (!el) return;

    // 动态导入 gsap + ScrollTrigger（避免 SSR 问题）
    let cleanup: (() => void) | undefined;

    const init = async () => {
      try {
        const gsapMod = await import("gsap");
        const { ScrollTrigger: ST } = await import("gsap/ScrollTrigger");
        gsapMod.default.registerPlugin(ST);

        const ctx = gsapMod.default.context(() => {
          ST.create({
            trigger: el,
            start: "top top",
            end: `+=${scrubHeight}`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            onUpdate: (self) => {
              const p = self.progress;
              setProgress(p);
              onProgress?.(p);
            },
            onLeave: () => onComplete?.(),
            onLeaveBack: () => {},
          });
        }, el);

        ctxRef.current = ctx;
        cleanup = () => ctx.revert();
      } catch {
        setProgress(1);
        onComplete?.();
      }
    };

    init();

    return () => {
      cleanup?.();
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, scrubHeight, onProgress, onComplete, pinRef]);

  return progress;
}
