"use client";

import { useLayoutEffect, useState } from "react";

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
 * 基于原生滚动的进度 Hook。
 * CSS sticky 负责固定画面，这里只把滚动距离映射为 0..1。
 */
export function useScrollProgress({
  pinRef,
  scrubHeight = 5000,
  onProgress,
  disabled = false,
}: UseScrollProgressOptions): number {
  const [progress, setProgress] = useState(0);

  useLayoutEffect(() => {
    const el = pinRef.current;
    if (disabled || !el) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const start = el.offsetTop;
      const raw = (window.scrollY - start) / Math.max(scrubHeight, 1);
      const nextProgress = Math.min(1, Math.max(0, raw));
      setProgress(nextProgress);
      onProgress?.(nextProgress);
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [disabled, scrubHeight, onProgress, pinRef]);

  return progress;
}
