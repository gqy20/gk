"use client";

import { cn } from "@/lib/utils";
import {
  type InputHTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** 左侧标签（如 "稳健谨慎"） */
  minLabel?: string;
  /** 右侧标签（如 "冒险探索"） */
  maxLabel?: string;
  /** 中间标签（如 "均衡"） */
  midLabel?: string;
  /** 显示当前数值，格式默认为 `${value}/${max}` */
  showValue?: boolean;
  /** 自定义值渲染 */
  valueRender?: (value: number) => React.ReactNode;
};

/**
 * 自建 Slider 原语 —— 纯 CSS + 原生 input[type=range]，零运行时依赖。
 *
 * 特性：
 * - 轨道填充效果（已滑过部分高亮）
 * - 圆形 thumb + 阴影
 * - 键盘方向键支持（原生）
 * - ARIA value-text 无障碍
 * - 与设计系统一致的配色（brand 渐变轨道）
 */
export function Slider({
  min = 0,
  max = 100,
  step = 1,
  value: controlledValue,
  defaultValue,
  onChange,
  minLabel,
  maxLabel,
  midLabel,
  showValue = true,
  valueRender,
  className,
  id,
  disabled,
  ...props
}: SliderProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(
    () => defaultValue ?? Number(min),
  );
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  // 轨道填充百分比
  const percent =
    ((Number(value) - Number(min)) / (Number(max) - Number(min))) * 100;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(e.target.value);
      if (!isControlled) setInternalValue(next);
      onChange?.(next);
    },
    [onChange, isControlled],
  );

  // 受控模式：外部 value 变化时同步到 DOM
  useEffect(() => {
    const el = internalRef.current;
    if (!el || isControlled || el.value === String(value)) return;
    el.value = String(value);
  }, [value, isControlled]);

  return (
    <div className={cn("w-full", className)}>
      {/* 数值显示行 */}
      {(showValue || valueRender) && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-text-secondary">
            {props["aria-label"] ?? "滑块"}
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-text">
            {valueRender ? valueRender(Number(value)) : `${Number(value)}/${max}`}
          </span>
        </div>
      )}

      {/* Slider 轨道容器 */}
      <div className="relative w-full">
        {/* 已填充轨道背景 */}
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full"
          style={{
            width: `${percent}%`,
            background:
              "linear-gradient(90deg, var(--color-brand-500), var(--color-accent-400))",
          }}
        />
        {/* 原生 range input */}
        <input
          ref={internalRef}
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-valuemin={Number(min)}
          aria-valuemax={Number(max)}
          aria-valuenow={Number(value)}
          aria-valuetext={`${Number(value)} / ${max}`}
          className="slider-input relative z-10 w-full cursor-pointer appearance-none bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
      </div>

      {/* 底部标签 */}
      {(minLabel || midLabel || maxLabel) && (
        <div className="mt-2 flex justify-between text-[11px] text-text-muted">
          <span>{minLabel}</span>
          {midLabel && <span>{midLabel}</span>}
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
