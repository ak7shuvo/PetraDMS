import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Mark() {
  return (
    <svg width="14" height="14" viewBox="0 0 32 32" aria-hidden>
      <path d="M16 2 29 9.5v13L16 30 3 22.5v-13z" fill="#C8202F" />
      <path d="M11 22V10h6.2a4.3 4.3 0 0 1 0 8.6H11" fill="none" stroke="#F6F1E7" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Petra-branded device frame. `laptop` has a browser-style chrome bar and hinge;
 * `tablet` is a thick-bezel terminal frame. The screen area is a fixed 16:10 box so nothing shifts on load.
 */
export function DeviceFrame({
  variant = "laptop",
  title,
  children,
  className,
  chrome = true,
}: {
  variant?: "laptop" | "tablet";
  title: string;
  children: ReactNode;
  className?: string;
  chrome?: boolean;
}) {
  if (variant === "tablet") {
    return (
      <div className={cn("relative rounded-[22px] border border-cream/15 bg-[#0b0b0b] p-[9px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] sm:rounded-[28px] sm:p-3", className)}>
        <span aria-hidden className="absolute left-1/2 top-[3px] h-1 w-1 -translate-x-1/2 rounded-full bg-cream/30 sm:top-1" />
        <div className="relative aspect-[16/10] overflow-hidden rounded-[12px] bg-ink sm:rounded-[16px]">{children}</div>
        <span aria-hidden className="absolute bottom-[3px] left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-cream/20 sm:bottom-1" />
      </div>
    );
  }
  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden rounded-t-[12px] border border-cream/15 bg-[#0b0b0b] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
        {chrome && (
          <div className="flex h-7 items-center gap-3 border-b border-line px-3">
            <span className="flex gap-1.5" aria-hidden>
              <i className="h-2 w-2 rounded-full bg-red" />
              <i className="h-2 w-2 rounded-full bg-cream/25" />
              <i className="h-2 w-2 rounded-full bg-cream/25" />
            </span>
            <span className="mx-auto flex items-center gap-2 text-[10px] tracking-[0.16em] text-cream-dim">
              <Mark />
              {title}
            </span>
            <span className="w-10" aria-hidden />
          </div>
        )}
        <div className="relative aspect-[16/10] bg-ink">{children}</div>
      </div>
      <div aria-hidden className="mx-auto h-[10px] w-[104%] -translate-x-[2%] rounded-b-[10px] border-x border-b border-cream/15 bg-gradient-to-b from-[#1b1b1b] to-[#0b0b0b]" style={{ width: "104%", marginLeft: "-2%" }} />
    </div>
  );
}
