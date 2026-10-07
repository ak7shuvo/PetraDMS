import { Container, Label } from "@/shared/section";
import { Reveal } from "@/components/motion/reveal";
import { SplitText } from "@/components/motion/split-text";
import { Counter } from "@/components/motion/counter";
import { ProductBadge } from "@/shared/product-badge";

const facts = [
  { n: 3, l: "Flagship products" },
  { n: 1, l: "Connected ecosystem" },
  { n: 5, l: "Hospitality industries served" },
];

export function Overview() {
  return (
    <section id="overview" className="bg-cream py-28 text-ink sm:py-40">
      <Container>
        <Reveal><Label className="text-red">02 / Company overview</Label></Reveal>
        <div className="mt-6 grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <SplitText
            text="Petra builds the software hospitality runs on."
            className="max-w-[16ch] text-[clamp(2.2rem,5vw,4.8rem)] font-extrabold leading-[0.97] tracking-[-0.06em]"
          />
          <Reveal delay={0.15}>
            <p className="max-w-[44ch] text-[15px] leading-relaxed text-ink/65">
              PETRA is a Bangladesh-based software company. We design, build and support our own hospitality products, so every screen comes from daily operations, not a template.
            </p>
          </Reveal>
        </div>

        <div className="mt-20 grid gap-px border border-ink/15 bg-ink/15 md:grid-cols-3">
          {(["PMS", "POS", "DMS"] as const).map((c, i) => (
            <Reveal key={c} delay={i * 0.1} className="bg-cream p-8 sm:p-10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-red">0{i + 1}</span>
              </div>
              <div className="mt-14 text-[clamp(3.4rem,7vw,5.5rem)] font-extrabold leading-none tracking-[-0.07em]">{c}</div>
              <div className="mt-4">
                <ProductBadge code={c} size="sm" tone="light" />
              </div>
            </Reveal>
          ))}
        </div>

        <dl className="mt-px grid border border-t-0 border-ink/15 sm:grid-cols-3">
          {facts.map((f, i) => (
            <div key={f.l} className={`p-8 sm:p-10 ${i ? "border-t border-ink/15 sm:border-l sm:border-t-0" : ""}`}>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-ink/55">{f.l}</dt>
              <dd className="mt-3 text-5xl font-extrabold tracking-[-0.06em]"><Counter to={f.n} /></dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
