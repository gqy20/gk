"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { getLogoFallbackUrls } from "@/lib/logo";
import type { School } from "@/lib/data";

/** 预设尺寸规格 */
const SIZE_PRESETS = {
  xs: { container: "h-5 w-5", text: "text-[10px]" }, // 20px - ProvinceList
  sm: { container: "h-8 w-8", text: "text-xs" }, // 32px - SchoolPopup
  md: { container: "h-9 w-9", text: "text-sm" }, // 36px - SchoolHeader
} as const;

type LogoSize = keyof typeof SIZE_PRESETS;

interface SchoolLogoProps {
  school: School;
  /** 预设尺寸 */
  size?: LogoSize;
  /** 自定义类名（追加到外层容器） */
  className?: string;
  /** 图片加载失败时的背景色 */
  fallbackBg?: string;
}

/**
 * 学校校徽组件
 *
 * 行为：
 * 1. 初始显示骨架屏占位
 * 2. 图片加载成功 → 显示圆形裁切校徽
 * 3. jpg 失败 → 自动尝试 png
 * 4. 全部失败 → 显示学校名称首字圆形占位
 */
export function SchoolLogo({
  school,
  size = "sm",
  className,
  fallbackBg,
}: SchoolLogoProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [urlIndex, setUrlIndex] = useState(0);
  const urls = getLogoFallbackUrls(school.name);
  const preset = SIZE_PRESETS[size];
  const initial = school.name.charAt(0);

  if (state === "error") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-text-inverse",
          preset.container,
          className,
        )}
        style={{ background: fallbackBg ?? "rgba(127, 159, 143, 0.72)" }}
        aria-label={`${school.name} 校徽`}
      >
        <span className={preset.text}>{initial}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-neutral-100/60",
        preset.container,
        className,
      )}
    >
      {/* 加载骨架屏 */}
      {state === "loading" && (
        <span className="absolute inset-0 animate-pulse rounded-full bg-neutral-200/40" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- local logo files need jpg/png fallback handled by onError. */}
      <img
        src={urls[urlIndex]}
        alt={`${school.name} 校徽`}
        className={cn(
          "h-full w-full object-cover",
          state === "loading" && "opacity-0",
        )}
        onLoad={() => setState("loaded")}
        onError={() => {
          if (urlIndex < urls.length - 1) {
            setUrlIndex((prev) => prev + 1);
          } else {
            setState("error");
          }
        }}
        decoding="async"
        loading="lazy"
      />
    </span>
  );
}
