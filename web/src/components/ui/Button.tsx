import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";
type ButtonTheme = "dark" | "light";

interface ButtonProps extends ComponentPropsWithoutRef<typeof motion.button> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  theme?: ButtonTheme;
  isActive?: boolean;
}

const variantStyles: Record<
  ButtonTheme,
  Record<ButtonVariant, string>
> = {
  dark: {
    primary:
      "border-border bg-surface-subtle text-text hover:border-primary/60 hover:bg-primary/10",
    secondary:
      "border-border bg-surface-active text-text-secondary hover:border-primary/60 hover:bg-primary/10",
    ghost: "border-transparent text-text-secondary hover:text-text hover:bg-surface-active",
    danger:
      "border-border bg-surface-active text-text-secondary hover:border-danger-200/40 hover:text-danger-100",
  },
  light: {
    primary:
      "border-brand-500 bg-brand-500 text-text hover:bg-brand-400 disabled:opacity-40",
    secondary:
      "border-border-light bg-surface-light-elevated text-text-light hover:border-brand-400/50 hover:bg-success-soft",
    ghost: "border-transparent text-text-light hover:text-brand-500 hover:bg-surface-light-subtle",
    danger:
      "border-border-light bg-surface-light-elevated text-text-light hover:border-danger-200/40 hover:text-danger-400",
  },
};

const activeStyles: Record<ButtonTheme, Record<ButtonVariant, string>> = {
  dark: {
    primary: "border-primary/60 bg-primary/10 text-text",
    secondary: "border-primary/60 bg-primary/10 text-text",
    ghost: "bg-surface-active text-text",
    danger: "border-danger-200/40 text-danger-100",
  },
  light: {
    primary: "border-brand-500 bg-brand-500 text-text",
    secondary: "border-brand-400/50 bg-success-soft text-brand-500",
    ghost: "bg-surface-light-subtle text-brand-500",
    danger: "border-danger-200/40 text-danger-400",
  },
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs font-medium",
  md: "h-9 px-4 text-xs font-medium",
  lg: "h-11 px-5 text-sm font-medium",
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  theme = "dark",
  isActive = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border transition",
        "disabled:cursor-not-allowed disabled:opacity-35",
        sizeStyles[size],
        isActive ? activeStyles[theme][variant] : variantStyles[theme][variant],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
