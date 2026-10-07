import { Section } from "@/shared/section";
import { Reveal } from "@/components/motion/reveal";
import { Icon } from "@/shared/icons";
import { industries } from "@/content/industries";
import { cn } from "@/lib/utils";

const CODES = ["PMS", "POS", "DMS"] as const;

export function Industries() {
  return (
    <Section
      id="industries"
      index="05"
      eyebrow="Industries we serve"
      title="Built for the people who host, serve and move guests."
      tone="cream"
    >
      <div className="grid gap-px border border-ink/15 bg-ink/15 sm:grid-cols-2 lg:grid-cols-5">
        {industries.map((ind, i) => (
          <Reveal key={ind.name} delay={i * 0.07} className="group relative bg-cream transition-colors duration-500 hover:bg-ink hover:text-cream">
            <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-red transition-transform duration-500 group-hover:scale-x-100" />
            <div className="flex h-full min-h-[320px] flex-col p-7">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-red">0{i + 1}</span>
                <Icon name={ind.icon} size={26} className="text-ink/80 transition-colors group-hover:text-red-glow" />
              </div>
              <h3 className="mt-auto whitespace-nowrap text-[22px] font-extrabold tracking-[-0.05em] xl:text-2xl">{ind.name}</h3>
              <p className="mt-3 min-h-[3.2em] text-[13px] leading-snug text-ink/65 transition-colors group-hover:text-cream-dim">{ind.line}</p>

              <div className="mt-6 flex gap-1.5" aria-label={`Products for ${ind.name}`}>
                {CODES.map((c) => {
                  const on = ind.products.includes(c);
                  return (
                    <span
                      key={c}
                      title={on ? `Petra${c}` : undefined}
                      className={cn(
                        "px-2 py-1 text-[10px] font-bold tracking-[0.14em] transition-colors",
                        on ? "bg-red text-cream" : "border border-ink/15 text-ink/25 group-hover:border-cream/15 group-hover:text-cream/25",
                      )}
                    >
                      {c}
                    </span>
                  );
                })}
              </div>
              {ind.module && <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-ink/50 group-hover:text-cream-mute">+ {ind.module}</div>}
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 text-[12px] text-ink/55">Filled tags show which Petra products serve each industry today.</p>
    </Section>
  );
}
