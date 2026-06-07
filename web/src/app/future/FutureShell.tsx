import type { ReactNode, ElementType } from "react";
import { TONE, type ToneKey } from "./_tone";

export function FutureShell({
  title,
  subtitle,
  eyebrow,
  backHref = "/",
  backLabel = "返回",
  headerControls,
  mainClassName = "",
  contentMaxClassName = "max-w-[1600px]",
  headerMaxClassName = "max-w-[1600px]",
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  headerControls?: ReactNode;
  mainClassName?: string;
  contentMaxClassName?: string;
  headerMaxClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-text">
      <header className="sticky top-0 z-20 border-b border-border bg-surface-elevated/90 backdrop-blur-xl">
        <div className={`mx-auto flex ${headerMaxClassName} items-center justify-between gap-3 px-3 py-2.5 sm:px-5`}>
          <div className="flex min-w-0 items-center gap-3">
            <a
              href={backHref}
              className="group flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-[11px] font-medium text-text-secondary transition hover:border-primary/40 hover:bg-brand-50 hover:text-primary"
            >
              <span aria-hidden className="transition group-hover:-translate-x-0.5">←</span>
              {backLabel}
            </a>
            {eyebrow && (
              <>
                <div className="hidden h-5 w-px bg-border sm:block" />
                <div className="hidden min-w-0 items-center gap-2 sm:flex">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
                    <span className="relative h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
                    {eyebrow}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="min-w-0 flex-1 text-center sm:flex-none">
            <h1 className="truncate text-base font-semibold tracking-tight text-text sm:text-lg">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">
              v2
            </span>
          </div>
        </div>
        {headerControls && (
          <div className={`mx-auto ${headerMaxClassName} border-t border-border/60 px-3 py-2 sm:px-5`}>
            {headerControls}
          </div>
        )}
      </header>

      <main className={`relative mx-auto ${contentMaxClassName} px-3 py-4 sm:px-5 sm:py-5 ${mainClassName}`}>
        {subtitle && (
          <p className="mb-4 max-w-3xl text-sm leading-7 text-text-secondary">
            {subtitle}
          </p>
        )}
        {children}
      </main>
    </div>
  );
}

export function FuturePanel({
  children,
  className = "",
  tone = "neutral",
  as,
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | ToneKey;
  as?: ElementType;
}) {
  const ringClass = tone === "neutral" ? "" : `${TONE[tone].ring} ring-1`;
  const Component: ElementType = as ?? "section";
  return (
    <Component
      className={`group relative overflow-hidden rounded-2xl border border-border bg-surface-elevated
                  shadow-[0_1px_0_0_rgba(255,255,255,0.7)_inset,0_18px_40px_-28px_rgba(17,24,32,0.35)]
                  transition hover:border-border-subtle ${ringClass} ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-200/80 to-transparent"
      />
      {children}
    </Component>
  );
}

export function SectionHeading({
  title,
  description,
  kicker,
}: {
  title: string;
  description?: string;
  kicker?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {kicker && (
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            {kicker}
          </div>
        )}
        <h2 className="text-sm font-semibold tracking-tight text-text">{title}</h2>
        {description && (
          <p className="mt-1 max-w-prose text-xs leading-5 text-text-secondary">{description}</p>
        )}
      </div>
    </div>
  );
}
