import { cn } from "@/lib/utils";
import { productIcon } from "./icons";
import { productByCode } from "@/content/products";
import type { ProductCode } from "@/types/content";

/** The one visual unit that teaches what each Petra product is: icon + code + full name. */
export function ProductBadge({
  code,
  size = "md",
  showFull = true,
  tone = "dark",
  className,
}: {
  tone?: "dark" | "light";
  code: ProductCode;
  size?: "sm" | "md" | "lg";
  showFull?: boolean;
  className?: string;
}) {
  const Icon = productIcon[code];
  const p = productByCode[code];
  const s = {
    sm: { box: "h-8 w-8", icon: 15, code: "text-[11px]", full: "text-[10px]" },
    md: { box: "h-11 w-11", icon: 20, code: "text-[13px]", full: "text-[11px]" },
    lg: { box: "h-14 w-14", icon: 26, code: "text-xl", full: "text-[12px]" },
  }[size];
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className={cn("grid shrink-0 place-items-center border bg-red/10", tone === "dark" ? "border-red/60 text-red-glow" : "border-red text-red", s.box)}>
        <Icon size={s.icon} aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className={cn("font-bold tracking-[0.16em]", s.code)}>{code}</span>
        {showFull && <span className={cn(tone === "dark" ? "text-cream-dim" : "text-ink/65", s.full)}>{p.full}</span>}
      </span>
    </span>
  );
}

/** Compact equation form: "PMS = Property Management System". */
export function Equation({ code, className }: { code: ProductCode; className?: string }) {
  const p = productByCode[code];
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 text-[12px]", className)}>
      <b className="tracking-[0.16em] text-red-glow">{code}</b>
      <span className="text-cream-mute">=</span>
      <span className="text-cream-dim">{p.full}</span>
    </span>
  );
}
