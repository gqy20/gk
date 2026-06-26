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

/**
 * 与设计系统协调的 fallback 配色板。
 * 取自 brand/accent/success 等语义色的低饱和变体，
 * 避免之前硬编码的单一魔法值。
 */
const FALLBACK_PALETTE = [
  "rgba(63, 143, 155, 0.72)",  // brand teal
  "rgba(47, 115, 125, 0.72)",  // brand-600
  "rgba(63, 143, 118, 0.72)",  // success green
  "rgba(197, 154, 75, 0.72)",  // accent gold
  "rgba(122, 95, 37, 0.72)",   // accent-700
  "rgba(79, 120, 121, 0.72)",  // muted teal
  "rgba(38, 93, 100, 0.72)",   // brand-700
  "rgba(151, 120, 85, 0.72)",  // warm bronze
];

/**
 * 基于校名生成确定性 fallback 颜色（同一所学校永远是同一颜色），
 * 类似 GitHub identicon 的思路。
 */
function hashNameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // 转 32 位整数
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

interface SchoolLogoProps {
  school: School;
  /** 预设尺寸 */
  size?: LogoSize;
  /** 自定义类名（追加到外层容器） */
  className?: string;
  /** 图片加载失败时的背景色（默认按校名 hash 生成） */
  fallbackBg?: string;
}

/**
 * 学校校徽组件
 *
 * 行为：
 * 1. 初始显示骨架屏占位
 * 2. 图片加载成功 → 淡入显示圆形裁切校徽
 * 3. jpg 失败 → 自动尝试 png
 * 4. 全部失败 → 显示学校名称首字圆形占位（背景色按校名 hash 确定）
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
  const resolvedFallbackBg = fallbackBg ?? hashNameToColor(school.name);

  if (state === "error") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-text-inverse",
          preset.container,
          className,
        )}
        style={{ background: resolvedFallbackBg }}
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
      {/* 加载骨架屏（与图片同层，淡入时被覆盖） */}
      {state === "loading" && (
        <span className="skeleton-shimmer absolute inset-0 rounded-full" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- local logo files need jpg/png fallback handled by onError. */}
      <img
        src={urls[urlIndex]}
        alt={`${school.name} 校徽`}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          state === "loading" ? "opacity-0" : "opacity-100",
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
