"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { DeviceFrame } from "@/components/ui/device-frame";
import { Reveal } from "@/components/motion/reveal";
import { Icon } from "@/shared/icons";
import { ProductBadge } from "@/shared/product-badge";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";
import type { Product } from "@/types/content";

export function ProductShowcase({ product: p, index }: { product: Product; index: number }) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [28, -28]);
  const flip = index % 2 === 1;
  const current = p.screens[active];

  return (
    <Reveal id={p.name.toLowerCase()} className="scroll-mt-24">
      <article
        ref={ref}
        className="group relative overflow-hidden border border-line bg-ink-2 transition-colors duration-500 hover:border-cream/25"
      >
        {/* ghost code */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -bottom-10 select-none text-[clamp(8rem,22vw,20rem)] font-extrabold leading-none tracking-[-0.08em] text-cream/[0.03]",
            flip ? "left-4" : "right-4",
          )}
        >
          {p.code}
        </span>
        <span aria-hidden className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-red transition-transform duration-700 ease-out group-hover:scale-x-100" />

        <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-14 lg:p-14">
          <div className={cn(flip && "lg:order-2")}>
            <ProductBadge code={p.code} size="lg" />
            <h3 className="mt-8 text-[clamp(2.4rem,5.6vw,4.6rem)] font-extrabold leading-[0.95] tracking-[-0.06em]">
              Petra<span className="text-red">{p.code}</span>
            </h3>
            <p className="mt-3 text-[12px] uppercase tracking-[0.22em] text-cream-mute">{p.full}</p>
            <p className="mt-6 max-w-[48ch] text-[15px] leading-relaxed text-cream-dim">{p.description}</p>

            <ul className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {p.features.map((f) => (
                <li key={f.title} className="flex items-center gap-3 text-[13px] text-cream/85">
                  <Icon name={f.icon} size={16} className="shrink-0 text-red-glow" />
                  {f.title}
                </li>
              ))}
            </ul>

            <a
              href="#contact"
              className="mt-10 inline-flex items-center gap-2 border-b border-red pb-1 text-[12px] uppercase tracking-[0.18em] transition-colors hover:text-red-glow"
            >
              Request a {p.name} demo <ArrowUpRight size={14} />
            </a>
          </div>

          <div className={cn("min-w-0", flip && "lg:order-1")}>
            <motion.div style={{ y }} className="transition-transform duration-500 ease-out will-change-transform group-hover:-translate-y-1">
              <DeviceFrame variant={p.device} title={`${p.name} · ${p.full}`}>
                {p.screens.map((s, i) => (
                  <Image
                    key={s.id}
                    src={s.src}
                    alt={s.alt}
                    fill
                    sizes="(min-width:1024px) 700px, 100vw"
                    className={cn("object-cover object-top transition-opacity duration-500", i === active ? "opacity-100" : "opacity-0")}
                    aria-hidden={i !== active}
                  />
                ))}
              </DeviceFrame>
            </motion.div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div role="tablist" aria-label={`${p.name} screens`} className="flex flex-wrap gap-1.5">
                {p.screens.map((s, i) => (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={i === active}
                    onClick={() => setActive(i)}
                    className="relative px-3.5 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors hover:text-cream"
                  >
                    {i === active && (
                      <motion.span layoutId={`tab-${p.code}`} className="absolute inset-0 border border-red bg-red/10" transition={{ duration: 0.45, ease }} />
                    )}
                    <span className={cn("relative", i === active ? "text-cream" : "text-cream-mute")}>{s.label}</span>
                  </button>
                ))}
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-cream-mute" aria-live="polite">
                {p.mockup ? "Product preview · illustrative data" : "Captured from the PetraDMS prototype"}
              </span>
            </div>
            <span className="sr-only">Showing {current.label}</span>
          </div>
        </div>
      </article>
    </Reveal>
  );
}
