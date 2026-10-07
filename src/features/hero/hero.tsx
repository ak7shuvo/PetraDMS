"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Magnetic } from "@/components/motion/magnetic";
import { ButtonLink } from "@/components/ui/button";
import { DeviceFrame } from "@/components/ui/device-frame";
import { Container, Label } from "@/shared/section";
import { ProductBadge } from "@/shared/product-badge";
import { useMouse } from "@/hooks/use-mouse";
import { ease } from "@/lib/motion";

function Parallax({ depth, className, children }: { depth: number; className?: string; children: React.ReactNode }) {
  const { x, y } = useMouse();
  const sx = useSpring(x, { stiffness: 50, damping: 20 });
  const sy = useSpring(y, { stiffness: 50, damping: 20 });
  const tx = useTransform(sx, (v) => v * depth);
  const ty = useTransform(sy, (v) => v * depth);
  return (
    <motion.div style={{ x: tx, y: ty }} className={className}>
      {children}
    </motion.div>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const visY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const enter = (delay: number) => ({
    initial: { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 1, ease, delay },
  });

  return (
    <section id="top" ref={ref} className="noise relative flex min-h-[100svh] items-center overflow-hidden bg-ink">
      <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_70%_at_70%_45%,#000_15%,transparent_72%)]" />
      <div className="pointer-events-none absolute -right-40 top-1/4 h-[560px] w-[560px] rounded-full bg-red/15 blur-[150px]" />

      <Container className="relative grid items-center gap-14 pb-28 pt-32 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8">
        <motion.div style={{ y: textY, opacity: fade }}>
          <motion.div {...enter(0.2)} className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red" />
            </span>
            <Label className="text-cream-dim">PETRA · Hospitality technology</Label>
          </motion.div>

          <h1 className="mt-8 text-[clamp(2.5rem,5vw,5rem)] font-extrabold leading-[0.96] tracking-[-0.06em]" aria-label="Software that runs hospitality.">
            {["Software", "that runs", "hospitality."].map((l, i) => (
              <span key={l} aria-hidden className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
                <motion.span
                  className={i === 2 ? "block text-red" : "block"}
                  initial={{ y: "115%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1.1, ease, delay: 0.35 + i * 0.1 }}
                >
                  {l}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p {...enter(0.85)} className="mt-8 max-w-[48ch] text-[15px] leading-relaxed text-cream-dim">
            Property, point of sale and distribution, built as one connected system for hotels, resorts, restaurants, tour operators and destination organizations.
          </motion.p>

          <motion.ul {...enter(1)} className="mt-9 grid max-w-[520px] gap-4 sm:grid-cols-3" aria-label="Petra products">
            {(["PMS", "POS", "DMS"] as const).map((c) => (
              <li key={c}>
                <ProductBadge code={c} size="sm" />
              </li>
            ))}
          </motion.ul>

          <motion.div {...enter(1.15)} className="mt-10 flex flex-wrap items-center gap-4">
            <Magnetic>
              <ButtonLink href="#contact">
                Book a Demo <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </ButtonLink>
            </Magnetic>
            <Magnetic strength={0.2}>
              <ButtonLink href="#products" variant="outline">Explore Products</ButtonLink>
            </Magnetic>
          </motion.div>
        </motion.div>

        {/* product composition */}
        <motion.div style={{ y: visY, opacity: fade }} className="relative mx-auto aspect-[1.12/1] w-full max-w-[720px] lg:max-w-none">
          <Parallax depth={-14} className="absolute right-0 top-0 w-[64%]">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease, delay: 0.5 }}>
              <DeviceFrame title="PetraDMS" chrome={false}>
                <Image src="/products/dms-dashboard.webp" alt="PetraDMS distribution dashboard" fill priority sizes="(min-width:1024px) 460px, 70vw" className="object-cover object-top" />
              </DeviceFrame>
            </motion.div>
          </Parallax>
          <Parallax depth={-30} className="absolute left-0 top-[16%] z-10 w-[68%]">
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease, delay: 0.7 }}>
              <DeviceFrame title="PetraPMS">
                <Image src="/products/pms-dashboard.webp" alt="PetraPMS property dashboard" fill priority sizes="(min-width:1024px) 480px, 75vw" className="object-cover object-top" />
              </DeviceFrame>
            </motion.div>
          </Parallax>
          <Parallax depth={-52} className="absolute bottom-0 right-[3%] z-20 w-[50%]">
            <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease, delay: 0.9 }}>
              <DeviceFrame variant="tablet" title="PetraPOS">
                <Image src="/products/pos-terminal.webp" alt="PetraPOS order terminal" fill priority sizes="(min-width:1024px) 360px, 50vw" className="object-cover object-top" />
              </DeviceFrame>
            </motion.div>
          </Parallax>
        </motion.div>
      </Container>

      <div className="absolute inset-x-0 bottom-0 border-t border-line/70">
        <Container className="flex items-center justify-between py-4 text-[10px] uppercase tracking-[0.22em] text-cream-mute">
          <span>Hotels · Resorts · Restaurants · Tour operators · DMOs</span>
          <span className="hidden sm:inline">Scroll<span className="ml-2 inline-block animate-[blink_1.4s_steps(2)_infinite]">▍</span></span>
        </Container>
      </div>
    </section>
  );
}
