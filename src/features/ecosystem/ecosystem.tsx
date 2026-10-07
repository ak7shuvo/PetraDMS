"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Section } from "@/shared/section";
import { Reveal } from "@/components/motion/reveal";
import { ProductBadge } from "@/shared/product-badge";
import { productByCode } from "@/content/products";
import { edges, layers, nodes } from "@/content/ecosystem";
import { cn } from "@/lib/utils";
import type { EcoNode } from "@/types/content";

const W = 1200;
const TOP = [20, 225, 430, 635];
const H = [175, 175, 175, 150];
const AREA_X = 250;
const AREA_W = 920;
const COUNT = [3, 4, 4, 4];
const FLAG = { w: 214, h: 104 };
const MOD = { w: 176, h: 60 };

const geo = Object.fromEntries(
  nodes.map((n) => {
    const size = n.tier === "flagship" ? FLAG : MOD;
    const x = AREA_X + (AREA_W * (n.slot + 0.5)) / COUNT[n.layer];
    const y = TOP[n.layer] + H[n.layer] / 2;
    return [n.id, { ...size, x, y }];
  }),
);

function edgePath(a: string, b: string) {
  let A = nodes.find((n) => n.id === a)!;
  let B = nodes.find((n) => n.id === b)!;
  if (A.layer > B.layer) [A, B] = [B, A];
  const ga = geo[A.id], gb = geo[B.id];
  if (A.layer === B.layer) {
    const [L, R] = ga.x < gb.x ? [ga, gb] : [gb, ga];
    return `M${L.x + L.w / 2} ${L.y} L${R.x - R.w / 2} ${R.y}`;
  }
  const y1 = ga.y + ga.h / 2, y2 = gb.y - gb.h / 2, m = (y1 + y2) / 2;
  return `M${ga.x} ${y1} C${ga.x} ${m} ${gb.x} ${m} ${gb.x} ${y2}`;
}

const neighbors = (id: string) =>
  edges.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));

export function Ecosystem() {
  const [selected, setSelected] = useState("pms");
  const [hover, setHover] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // gentle auto-tour of the three flagships until the visitor interacts
  useEffect(() => {
    if (touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const order = ["pms", "pos", "dms"];
    const t = setInterval(() => setSelected((s) => order[(order.indexOf(s) + 1) % order.length] ?? "pms"), 4200);
    return () => clearInterval(t);
  }, [touched]);

  const pick = (id: string) => { setTouched(true); setSelected(id); };
  const active = hover ?? selected;
  const node = nodes.find((n) => n.id === active)!;
  const linked = useMemo(() => new Set([active, ...neighbors(active)]), [active]);
  const links = useMemo(() => neighbors(active).map((id) => nodes.find((n) => n.id === id)!), [active]);

  return (
    <Section
      id="ecosystem"
      index="04"
      eyebrow="Petra ecosystem"
      title="Every product connects. Pick one to see how."
      lede="Guests book, the property operates, distribution decides, and one core platform keeps it all in sync."
    >
      {/* the three categories, visual first */}
      <div className="grid gap-px border border-line bg-line md:grid-cols-3">
        {(["pms", "pos", "dms"] as const).map((id) => {
          const n = nodes.find((x) => x.id === id)!;
          const p = productByCode[n.code!];
          const on = selected === id;
          return (
            <button
              key={id}
              onClick={() => pick(id)}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover(null)}
              aria-pressed={on}
              className={cn("group relative overflow-hidden p-6 text-left transition-colors duration-300 sm:p-8", on ? "bg-ink-3" : "bg-ink-2 hover:bg-ink-3/70")}
            >
              <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[2px] origin-left bg-red transition-transform duration-500", on ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100")} />
              <div className="flex items-start justify-between gap-4">
                <ProductBadge code={n.code!} size="md" showFull={false} />
                <span className="text-[10px] uppercase tracking-[0.2em] text-cream-mute">{p.name}</span>
              </div>
              <div className="mt-8 text-[clamp(3rem,6vw,4.6rem)] font-extrabold leading-none tracking-[-0.07em]">{n.code}</div>
              <div className="mt-3 flex items-baseline gap-2 text-[13px]">
                <span className="text-red-glow">=</span>
                <span className="font-semibold">{p.full}</span>
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-cream-mute">{p.tagline}</div>
            </button>
          );
        })}
      </div>

      {/* desktop: interactive layered diagram */}
      <Reveal className="mt-8 hidden lg:block">
        <div className="relative border border-line bg-ink">
          <svg viewBox={`0 0 ${W} 800`} className="block h-auto w-full" role="group" aria-label="Petra ecosystem diagram. Select a node to see its connections.">
            {layers.map((l, i) => (
              <g key={l.id}>
                <rect x="0.5" y={TOP[i]} width={W - 1} height={H[i]} fill={i === 3 ? "rgba(200,32,47,0.07)" : "#161616"} stroke={i === 3 ? "rgba(200,32,47,0.45)" : "#2c2c2c"} />
                <text x="28" y={TOP[i] + H[i] / 2 - 18} fill="#E23A49" fontSize="11" letterSpacing="3">{`0${i + 1}`}</text>
                <text x="28" y={TOP[i] + H[i] / 2 + 6} fill="#F6F1E7" fontSize="15" fontWeight="700" letterSpacing="0.5">{l.label}</text>
                <text x="28" y={TOP[i] + H[i] / 2 + 26} fill="#8A867D" fontSize="11">{l.hint}</text>
              </g>
            ))}

            {edges.map(([a, b]) => {
              const on = a === active || b === active;
              return (
                <g key={a + b}>
                  <path d={edgePath(a, b)} fill="none" stroke="#F6F1E7" strokeOpacity={on ? 0 : 0.1} strokeWidth="1" />
                  {on && <path d={edgePath(a, b)} fill="none" stroke="#E23A49" strokeWidth="2" strokeDasharray="6 8" className="eco-flow" />}
                </g>
              );
            })}

            {nodes.map((n) => <NodeShape key={n.id} n={n} active={active === n.id} lit={linked.has(n.id)} onPick={pick} onHover={setHover} />)}
          </svg>
        </div>
      </Reveal>

      {/* mobile / tablet: stacked layers */}
      <div className="mt-8 flex flex-col gap-3 lg:hidden">
        {layers.map((l, i) => (
          <div key={l.id}>
            <div className={cn("border p-4", i === 3 ? "border-red/40 bg-red/[0.06]" : "border-line bg-ink-2")}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px] font-bold">{l.label}</span>
                <span className="text-[10px] text-cream-mute">{l.hint}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {nodes.filter((n) => n.layer === i).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => pick(n.id)}
                    aria-pressed={selected === n.id}
                    className={cn(
                      "border px-3 py-2 text-left text-[12px] transition-colors",
                      selected === n.id ? "border-red bg-red/15" : linked.has(n.id) ? "border-red/50" : "border-line",
                      n.tier === "flagship" && "font-bold",
                    )}
                  >
                    {n.code && <span className="mr-2 text-red-glow">{n.code}</span>}
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
            {i < layers.length - 1 && <div className="flex justify-center py-1 text-cream-mute"><ArrowDown size={14} aria-hidden /></div>}
          </div>
        ))}
      </div>

      {/* detail bar */}
      <div className="mt-px grid gap-6 border border-line bg-ink-2 p-6 sm:p-8 lg:grid-cols-[1.1fr_1.2fr_auto] lg:items-center" aria-live="polite">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-red-glow">{layers[node.layer].label}</div>
          <div className="mt-2 text-3xl font-extrabold tracking-[-0.05em]">{node.label}</div>
          {node.full && <div className="mt-1 text-[13px] text-cream-dim">{node.code} = {node.full}</div>}
        </div>
        <div>
          <p className="text-[14px] text-cream/85">{node.role}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-cream-mute">Connects to</span>
            {links.map((l) => (
              <button key={l.id} onClick={() => pick(l.id)} className="border border-line px-2.5 py-1 text-[11px] transition-colors hover:border-red hover:text-cream">
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <a href="#contact" className="inline-flex items-center gap-2 border-b border-red pb-1 text-[12px] uppercase tracking-[0.18em] hover:text-red-glow">
          See it in a demo <ArrowUpRight size={14} />
        </a>
      </div>

      <div className="mt-4 flex flex-wrap gap-6 text-[11px] text-cream-mute">
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 border border-red bg-red/20" />Flagship product</span>
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 border border-cream/30" />Ecosystem module</span>
      </div>
    </Section>
  );
}

function NodeShape({
  n, active, lit, onPick, onHover,
}: {
  n: EcoNode; active: boolean; lit: boolean;
  onPick: (id: string) => void; onHover: (id: string | null) => void;
}) {
  const g = geo[n.id];
  const x = g.x - g.w / 2, y = g.y - g.h / 2;
  const flagship = n.tier === "flagship";
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${n.label}${n.full ? `, ${n.full}` : ""}`}
      aria-pressed={active}
      onClick={() => onPick(n.id)}
      onMouseEnter={() => onHover(n.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(n.id)}
      onBlur={() => onHover(null)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(n.id); } }}
      className="cursor-pointer outline-none"
      style={{ opacity: lit ? 1 : 0.5, transition: "opacity .35s ease" }}
    >
      {active && <rect x={x - 5} y={y - 5} width={g.w + 10} height={g.h + 10} fill="none" stroke="#C8202F" strokeOpacity="0.35" />}
      <rect
        x={x} y={y} width={g.w} height={g.h}
        fill={flagship ? "#1f1f1f" : "#121212"}
        stroke={active ? "#C8202F" : flagship ? "rgba(246,241,231,0.55)" : "rgba(246,241,231,0.25)"}
        strokeWidth={active ? 1.8 : 1}
        style={{ transition: "stroke .3s ease" }}
      />
      {flagship ? (
        <>
          <rect x={x} y={y} width="4" height={g.h} fill="#C8202F" />
          <text x={x + 20} y={y + 36} fill="#F6F1E7" fontSize="26" fontWeight="800" letterSpacing="3">{n.code}</text>
          <text x={x + 20} y={y + 60} fill="#E23A49" fontSize="13" fontWeight="700">{n.label}</text>
          <text x={x + 18} y={y + 82} fill="#B9B4A9" fontSize="10">{n.full}</text>
        </>
      ) : (
        <text x={g.x} y={g.y + 5} textAnchor="middle" fill="#F6F1E7" fontSize="14" fontWeight="600">{n.label}</text>
      )}
    </g>
  );
}
