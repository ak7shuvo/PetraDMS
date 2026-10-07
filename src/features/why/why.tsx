import { Section } from "@/shared/section";
import { Reveal } from "@/components/motion/reveal";
import { Icon } from "@/shared/icons";
import { reasons } from "@/content/why";

export function Why() {
  return (
    <Section id="why" index="06" eyebrow="Why Petra" title="Real products. One ecosystem. Local support.">
      <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {reasons.map((r, i) => (
          <Reveal key={r.title} delay={(i % 3) * 0.07} className="group relative bg-ink p-8 transition-colors duration-500 hover:bg-ink-2 sm:p-10">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-red transition-transform duration-500 group-hover:scale-x-100" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-red-glow">0{i + 1}</span>
              <Icon name={r.icon} size={22} className="text-cream-dim transition-colors group-hover:text-red-glow" />
            </div>
            <h3 className="mt-16 text-2xl font-bold tracking-[-0.04em]">{r.title}</h3>
            <p className="mt-3 max-w-[34ch] text-[13px] leading-relaxed text-cream-dim">{r.text}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
