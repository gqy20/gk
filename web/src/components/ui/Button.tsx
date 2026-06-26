import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { IconSpinner } from "./Icon";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-md border font-medium",
    "transition-colors duration-150 shadow-sm shadow-white/30",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-35",
  ],
  {
    variants: {
      variant: {
        primary: "",
        secondary: "",
        ghost: "border-transparent shadow-none",
        danger: "",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-xs",
        lg: "h-11 px-5 text-sm",
      },
      theme: {
        dark: "",
        light: "",
      },
      active: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        theme: "dark",
        variant: "primary",
        active: false,
        className: "border-brand-600/35 bg-brand-500 text-text-inverse hover:bg-brand-600",
      },
      {
        theme: "dark",
        variant: "secondary",
        active: false,
        className: "border-border bg-neutral-0/82 text-text-secondary hover:border-primary/50 hover:bg-brand-50 hover:text-primary",
      },
      {
        theme: "dark",
        variant: "ghost",
        active: false,
        className: "text-text-secondary hover:bg-surface-subtle hover:text-text",
      },
      {
        theme: "dark",
        variant: "danger",
        active: false,
        className: "border-border bg-neutral-0/82 text-text-secondary hover:border-danger-200/60 hover:bg-danger-soft hover:text-danger",
      },
      {
        theme: "light",
        variant: "primary",
        active: false,
        className: "border-brand-600/35 bg-brand-500 text-text-inverse hover:bg-brand-600",
      },
      {
        theme: "light",
        variant: "secondary",
        active: false,
        className: "border-border-light bg-neutral-0/82 text-text-light hover:border-brand-400/50 hover:bg-success-soft",
      },
      {
        theme: "light",
        variant: "ghost",
        active: false,
        className: "text-text-light hover:bg-surface-light-subtle hover:text-brand-500",
      },
      {
        theme: "light",
        variant: "danger",
        active: false,
        className: "border-border-light bg-neutral-0/82 text-text-light hover:border-danger-200/40 hover:bg-danger-soft hover:text-danger-500",
      },
      {
        theme: "dark",
        variant: "primary",
        active: true,
        className: "border-primary bg-primary text-text-inverse",
      },
      {
        theme: "dark",
        variant: "secondary",
        active: true,
        className: "border-primary/50 bg-brand-50 text-primary",
      },
      {
        theme: "dark",
        variant: "ghost",
        active: true,
        className: "bg-surface-subtle text-text",
      },
      {
        theme: "dark",
        variant: "danger",
        active: true,
        className: "border-danger-200/60 bg-danger-soft text-danger",
      },
      {
        theme: "light",
        variant: "primary",
        active: true,
        className: "border-brand-500 bg-brand-500 text-text-inverse",
      },
      {
        theme: "light",
        variant: "secondary",
        active: true,
        className: "border-brand-400/50 bg-success-soft text-brand-500",
      },
      {
        theme: "light",
        variant: "ghost",
        active: true,
        className: "bg-surface-light-subtle text-brand-500",
      },
      {
        theme: "light",
        variant: "danger",
        active: true,
        className: "border-danger-200/40 text-danger-400",
      },
    ],
    defaultVariants: {
      variant: "secondary",
      size: "md",
      theme: "dark",
      active: false,
    },
  },
);

interface ButtonProps
  extends Omit<ComponentPropsWithoutRef<typeof motion.button>, "children">,
    VariantProps<typeof buttonVariants> {
  isActive?: boolean;
  /** 加载态：渲染 spinner 并禁用交互（同时隐含 disabled） */
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  className,
  variant,
  size,
  theme,
  active,
  isActive,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const pressed = active ?? isActive ?? false;
  const isDisabled = disabled || loading;

  const spinnerSize = size === "lg" ? 15 : size === "sm" ? 12 : 13;

  return (
    <motion.button
      type="button"
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { scale: 1.03 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      className={cn(buttonVariants({ variant, size, theme, active: pressed }), className)}
      {...props}
    >
      {loading && <IconSpinner size={spinnerSize} className="text-current" />}
      {children}
    </motion.button>
  );
}
