import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SplitText } from "@/components/motion/split-text";
import { Reveal } from "@/components/motion/reveal";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1320px] px-5 sm:px-8", className)}>{children}</div>;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("text-[11px] uppercase tracking-[0.22em] text-red-glow", className)}>{children}</span>
  );
}

type SectionProps = {
  id?: string;
  index?: string;
  eyebrow: string;
  title: string;
  lede?: string;
  tone?: "dark" | "cream";
  children?: ReactNode;
  className?: string;
};

/** Reusable section shell: numbered eyebrow, display heading, lede, then composed children. */
export function Section({ id, index, eyebrow, title, lede, tone = "dark", children, className }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative py-28 sm:py-40",
        tone === "cream" ? "bg-cream text-ink" : "bg-ink text-cream",
        className,
      )}
    >
      <Container>
        <div className={cn("mb-16 grid gap-8 lg:items-end", lede && "lg:grid-cols-[1fr_420px]")}>
          <div>
            <Reveal>
              <Label className={tone === "cream" ? "text-red" : undefined}>
                {index ? `${index} / ` : ""}
                {eyebrow}
              </Label>
            </Reveal>
            <SplitText
              text={title}
              className="mt-6 max-w-[22ch] text-[clamp(2rem,4.4vw,4.2rem)] font-bold leading-[1] tracking-[-0.05em]"
            />
          </div>
          {lede && (
            <Reveal delay={0.15}>
              <p className={cn("text-[15px] leading-relaxed", tone === "cream" ? "text-ink/65" : "text-cream-dim")}>
                {lede}
              </p>
            </Reveal>
          )}
        </div>
        {children}
      </Container>
    </section>
  );
}
