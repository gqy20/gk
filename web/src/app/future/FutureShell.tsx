import type { ReactNode } from "react";

export function FutureShell({
  title,
  subtitle,
  eyebrow,
  backHref = "/",
  backLabel = "返回",
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f0e7] text-[#1d241f]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f4f0e7]/92 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <a href={backHref} className="text-xs font-medium text-[#657064] transition hover:text-[#1d241f]">
              ← {backLabel}
            </a>
            <div className="mt-1 flex min-w-0 items-baseline gap-3">
              <h1 className="truncate text-lg font-semibold tracking-normal text-[#172019] sm:text-2xl">
                {title}
              </h1>
              {eyebrow && <span className="hidden text-xs text-[#7c7260] sm:inline">{eyebrow}</span>}
            </div>
          </div>
          <div className="hidden rounded-full border border-[#d6c9ab] bg-[#fffaf0] px-3 py-1 text-xs text-[#7c6a36] sm:block">
            LLM 推演
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {subtitle && (
          <p className="mb-5 max-w-3xl text-sm leading-7 text-[#657064]">{subtitle}</p>
        )}
        {children}
      </main>
    </div>
  );
}

export function FuturePanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-black/10 bg-[#fffaf0] shadow-sm shadow-black/5 ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[#172019]">{title}</h2>
      {description && <p className="mt-1 text-xs leading-5 text-[#657064]">{description}</p>}
    </div>
  );
}
