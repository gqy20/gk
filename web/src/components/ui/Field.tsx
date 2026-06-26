"use client";

import { cn } from "@/lib/utils";
import { type LabelHTMLAttributes, type ReactNode } from "react";
import { Label } from "./Label";
import { Input } from "./Input";
import type { InputHTMLAttributes } from "react";

type FieldProps = {
  /** 标签文字 */
  label?: string;
  /** 是否必填（显示红色星号） */
  required?: boolean;
  /** 错误信息（有值时进入 error 态） */
  error?: string;
  /** 提示文案（label 下方的辅助说明） */
  hint?: string;
  /** 输入框右侧或下方的错误提示位置 */
  children: ReactNode;
  /** 容器额外 class */
  className?: string;
  /** 标签的 htmlFor，关联 input id */
  htmlFor?: string;
};

/**
 * Field 表单包裹组件 —— 统一管理 Label + Input/Error/Hint 的布局和交互态。
 *
 * 解决的问题：
 * - Label 的 spacing 不应写在 label 元素自身
 * - 必填字段无视觉标识
 * - 错误信息散落在各处，样式不统一
 * - 缺少 aria-describedby 关联
 */
export function Field({
  label,
  required,
  error,
  hint,
  children,
  className,
  htmlFor,
}: FieldProps) {
  const errorId = error ? `${htmlFor ?? "field"}-error` : undefined;
  const hintId = hint ? `${htmlFor ?? "field"}-hint` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label
          htmlFor={htmlFor}
          className={cn(
            "space-y-0",
            error && "text-danger",
          )}
        >
          {required && (
            <span className="mr-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
          {label}
          {hint && !error && (
            <span className="ml-1.5 font-normal text-text-muted">
              ({hint})
            </span>
          )}
        </Label>
      )}
      {children}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-[11px] leading-4 text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** 快捷：Field + Input 组合，覆盖 90% 场景 */
type TextFieldProps = InputHTMLAttributes<HTMLInputElement> &
  Pick<FieldProps, "label" | "required" | "error" | "hint" | "className">;

export function TextField({
  label,
  required,
  error,
  hint,
  className,
  id,
  ...inputProps
}: TextFieldProps) {
  return (
    <Field
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={className}
      htmlFor={id}
    >
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id ?? "field"}-error` : hint ? `${id ?? "field"}-hint` : undefined
        }
        className={cn(
          error && "border-danger/50 focus:border-danger/60 focus:ring-danger/20",
        )}
        {...inputProps}
      />
    </Field>
  );
}
