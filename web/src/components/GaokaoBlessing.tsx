import Image from "next/image";
import { cn } from "@/lib/utils";

const DECOR = {
  apple: "/decor/selected/noto-apple.svg",
  certificate: "/decor/selected/certificate-uxwing.svg",
  orange: "/decor/selected/noto-orange.svg",
  scroll: "/decor/selected/noto-scroll.svg",
};

function DecorIcon({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={24}
      height={24}
      className={cn("shrink-0 object-contain", className)}
      loading="lazy"
    />
  );
}

export function HeaderBlessing({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "hidden shrink-0 items-center gap-1.5 rounded-md border border-accent/30 bg-accent-50/55 px-2.5 py-1 text-[11px] font-medium text-accent-700 shadow-sm shadow-accent-800/5 md:inline-flex",
        className,
      )}
      title="金榜题名，平安上岸"
    >
      <DecorIcon src={DECOR.orange} alt="" className="h-4 w-4" />
      <DecorIcon src={DECOR.apple} alt="" className="h-4 w-4" />
      <span className="whitespace-nowrap">金榜题名</span>
    </div>
  );
}

export function PanelBlessing({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-accent/25 bg-surface-elevated/58 px-2.5 py-1.5 text-xs text-text-secondary shadow-sm shadow-accent-800/5",
        className,
      )}
    >
      <DecorIcon src={DECOR.certificate} alt="" className="h-5 w-5 opacity-75" />
      <span className="min-w-0 truncate">金榜题名，稳稳上岸</span>
    </div>
  );
}

export function ResultBlessing({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute right-3 top-3 hidden items-center gap-1.5 rounded-full border border-accent/25 bg-surface-elevated/70 px-2 py-1 shadow-sm shadow-accent-800/5 backdrop-blur-sm sm:flex",
        className,
      )}
      aria-hidden="true"
    >
      <DecorIcon src={DECOR.scroll} alt="" className="h-6 w-6" />
      <DecorIcon src={DECOR.orange} alt="" className="h-5 w-5" />
      <DecorIcon src={DECOR.apple} alt="" className="h-5 w-5" />
    </div>
  );
}
