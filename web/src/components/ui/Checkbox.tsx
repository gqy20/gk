"use client";

import { cn } from "@/lib/utils";
import { IconCheck } from "./Icon";
import {
  type ButtonHTMLAttributes,
  type ForwardedRef,
  forwardRef,
  useState,
} from "react";

type CheckboxProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  /** 尺寸 */
  size?: "sm" | "md";
};

/**
 * 视觉定制的圆形 Checkbox —— 无障碍、键盘可操作、与设计系统一致。
 *
 * 用 `<button role="checkbox" aria-checked>` 实现：
 * - Space/Enter 切换状态（原生 button 行为）
 * - Tab 可聚焦、focus ring 可见
 * - 外层 padding 保证 ≥32px 触控区域
 * - checked 时 brand 色填充 + 对勾图标
 */
export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  function Checkbox(
    {
      checked: controlledChecked,
      defaultChecked = false,
      onChange,
      size = "sm",
      disabled,
      className,
      ...props
    },
    ref: ForwardedRef<HTMLButtonElement>,
  ) {
    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : internalChecked;

    const toggle = () => {
      if (disabled) return;
      const next = !checked;
      if (!isControlled) setInternalChecked(next);
      onChange?.(next);
    };

    const sizeStyles = {
      sm: "h-4 w-4",
      md: "h-5 w-5",
    };

    const iconSizes = {
      sm: 10,
      md: 12,
    };

    return (
      <button
        type="button"
        ref={ref}
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          "inline-flex items-center justify-center rounded-full border-2 transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
          // 外层触控区域至少 32px，视觉尺寸由 size 控制
          "p-[7px]",
          sizeStyles[size],
          checked
            ? "border-brand-500 bg-brand-500 shadow-sm shadow-brand-500/20"
            : disabled
              ? "border-dashed border-neutral-200 bg-neutral-0/60 cursor-not-allowed opacity-40"
              : "border-dashed border-neutral-300 bg-neutral-0/80 hover:border-brand-400 hover:bg-success-soft",
          className,
        )}
        {...props}
      >
        {checked && (
          <IconCheck
            size={iconSizes[size]}
            className="text-text-inverse"
            aria-hidden="true"
          />
        )}
      </button>
    );
  },
);
