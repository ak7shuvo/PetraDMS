import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const base =
  "group inline-flex items-center justify-center gap-3 h-12 px-6 text-[13px] font-medium uppercase tracking-[0.12em] transition-colors duration-300 cursor-pointer select-none";

const variants = {
  primary: "bg-red text-cream hover:bg-red-glow",
  outline: "border border-cream/25 text-cream hover:border-cream hover:bg-cream hover:text-ink",
  ghost: "text-cream-dim hover:text-cream",
} as const;

type Variant = keyof typeof variants;

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(
  ({ className, variant = "primary", ...p }, ref) => (
    <button ref={ref} className={cn(base, variants[variant], className)} {...p} />
  ),
);
Button.displayName = "Button";

export function ButtonLink({
  className,
  variant = "primary",
  ...p
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return <a className={cn(base, variants[variant], className)} {...p} />;
}
