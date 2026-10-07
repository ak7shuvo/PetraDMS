"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Mail, Phone } from "lucide-react";
import { Container, Label } from "@/shared/section";
import { SplitText } from "@/components/motion/split-text";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";
import type { Inquiry, InquiryResponse } from "@/types/inquiry";

const types = ["Hotel", "Resort", "Restaurant or café", "Tour operator", "DMO / destination organization", "Something else"];
const interests = ["PetraPMS", "PetraPOS", "PetraDMS", "The full ecosystem", "Not sure yet"];
const budgets = ["Under ৳ 1 lakh", "৳ 1–3 lakh", "৳ 3–5 lakh", "৳ 5–10 lakh", "Above ৳ 10 lakh", "Not sure yet"];
const timelines = ["As soon as possible", "Within 1 month", "1–3 months", "3–6 months", "Flexible"];
const slots = ["Morning (10am–1pm)", "Afternoon (2pm–5pm)", "Evening (6pm–8pm)"];
const steps = ["Business", "Products", "Setup", "Call", "You"];

const empty: Inquiry = {
  projectType: "", services: [], requirements: "", budget: "", timeline: "", call: null,
  name: "", company: "", email: "", phone: "", website: "",
};

function Choice({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 border px-4 py-3 text-left text-[13px] transition-colors",
        on ? "border-red bg-red/15 text-cream" : "border-line hover:border-cream/40",
      )}
    >
      {children}
      {on && <Check size={14} className="shrink-0 text-red-glow" />}
    </button>
  );
}

function Field({ id, label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[11px] uppercase tracking-[0.18em] text-cream-mute">{label}</label>
      <input id={id} {...p} className="h-12 border border-line bg-ink px-4 text-sm outline-none transition-colors focus:border-red" />
    </div>
  );
}

export function Contact() {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Inquiry>(empty);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<InquiryResponse | null>(null);
  const [wantCall, setWantCall] = useState(false);

  const set = <K extends keyof Inquiry>(k: K, v: Inquiry[K]) => { setD((p) => ({ ...p, [k]: v })); setErr(""); };
  const toggleService = (s: string) => set("services", d.services.includes(s) ? d.services.filter((x) => x !== s) : [...d.services, s]);

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  function validate(): string {
    if (step === 0 && !d.projectType) return "Choose what you are building.";
    if (step === 1 && d.requirements.trim().length < 10) return "Tell us a little about your operation (at least 10 characters).";
    if (step === 3 && wantCall && !d.call?.date) return "Pick a date, or switch to no call.";
    if (step === 4) {
      if (!d.name.trim()) return "Enter your name.";
      if (!/^\S+@\S+\.\S{2,}$/.test(d.email.trim())) return "Enter a valid email, like name@company.com.";
      if (d.phone.replace(/\D/g, "").length < 10) return "Enter a phone number with at least 10 digits.";
    }
    return "";
  }

  async function next() {
    const e = validate();
    if (e) return setErr(e);
    if (step < 4) return setStep(step + 1);
    setBusy(true);
    try {
      const r = await fetch("/api/inquiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
      const j: InquiryResponse = await r.json();
      if (!j.ok) setErr(j.error ?? "Something went wrong. Please try again.");
      else setRes(j);
    } catch {
      setErr("Could not reach the server. Email us directly and we will reply within one working day.");
    } finally {
      setBusy(false);
    }
  }

  const mailto = res?.ref
    ? `mailto:${site.email}?subject=${encodeURIComponent(`${d.projectType} (${res.ref})`)}&body=${encodeURIComponent(
        `Reference: ${res.ref}\nName: ${d.name}\nCompany: ${d.company}\nPhone: ${d.phone}\nServices: ${d.services.join(", ") || "-"}\nBudget: ${d.budget || "-"}\nTimeline: ${d.timeline || "-"}\n${d.call ? `Call: ${d.call.date}, ${d.call.slot}\n` : ""}\n${d.requirements}`,
      )}`
    : "";

  return (
    <section id="contact" className="relative overflow-hidden bg-ink py-28 sm:py-40">
      <div className="pointer-events-none absolute -left-40 top-0 h-[520px] w-[520px] rounded-full bg-red/20 blur-[140px]" />
      <Container className="relative grid gap-16 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Label>07 / Book a demo</Label>
          <SplitText text="See Petra running on your property." className="mt-6 max-w-[14ch] text-[clamp(2.3rem,4.8vw,4.6rem)] font-extrabold leading-[0.97] tracking-[-0.06em]" />
          <p className="mt-8 max-w-[44ch] text-[15px] leading-relaxed text-cream-dim">
            Pick the products you care about and we will walk you through them live. We reply within one working day.
          </p>
          <div className="mt-12 flex flex-col gap-5 text-sm">
            <a href={`mailto:${site.email}`} className="flex items-center gap-4 hover:text-red-glow"><Mail size={18} className="text-red-glow" />{site.email}</a>
            <a href={`tel:${site.phoneHref}`} className="flex items-center gap-4 hover:text-red-glow"><Phone size={18} className="text-red-glow" />{site.phone}</a>
          </div>
        </div>

        <div className="border border-line bg-ink-2 p-6 sm:p-10" aria-live="polite">
          {res ? (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease }} className="flex flex-col items-center py-8 text-center">
              <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
                <motion.circle cx="44" cy="44" r="40" fill="none" stroke="#C8202F" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease }} />
                <motion.path d="M26 45l12 12 24-26" fill="none" stroke="#F6F1E7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.7, ease }} />
              </svg>
              <h3 className="mt-8 text-3xl font-bold tracking-[-0.05em]">Thank you, {d.name.split(" ")[0]}.</h3>
              <p className="mt-3 text-sm text-cream-dim">{res.delivered ? "Your inquiry has been received." : "Your inquiry is recorded."} Keep this reference:</p>
              <div className="mt-5 border border-dashed border-red px-5 py-3 text-lg font-semibold text-red-glow">{res.ref}</div>
              {!res.delivered && (
                <>
                  <p className="mt-6 max-w-[40ch] text-[13px] text-cream-dim">To make sure it reaches us right away, send the same details by email.</p>
                  <a href={mailto} className="mt-4 inline-flex h-12 items-center bg-red px-6 text-[13px] font-medium uppercase tracking-[0.12em] hover:bg-red-glow">Email it to PETRA</a>
                </>
              )}
            </motion.div>
          ) : (
            <>
              <ol className="mb-10 flex items-center gap-2" aria-label="Progress">
                {steps.map((s, i) => (
                  <li key={s} className="flex flex-1 flex-col gap-2" aria-current={i === step ? "step" : undefined}>
                    <span className="relative h-px bg-line">
                      <motion.span className="absolute inset-y-0 left-0 bg-red" animate={{ width: i <= step ? "100%" : "0%" }} transition={{ duration: 0.5, ease }} />
                    </span>
                    <span className={cn("hidden text-[10px] uppercase tracking-[0.16em] sm:block", i === step ? "text-cream" : "text-cream-mute")}>{s}</span>
                  </li>
                ))}
              </ol>

              <form onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
                <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
                  <label>Leave empty<input tabIndex={-1} autoComplete="off" value={d.website} onChange={(e) => set("website", e.target.value)} /></label>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35, ease }} className="min-h-[340px]">
                    {step === 0 && (
                      <fieldset>
                        <legend className="text-2xl font-bold tracking-[-0.04em]">What kind of business are you?</legend>
                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                          {types.map((t) => <Choice key={t} on={d.projectType === t} onClick={() => set("projectType", t)}>{t}</Choice>)}
                        </div>
                      </fieldset>
                    )}
                    {step === 1 && (
                      <div>
                        <h3 className="text-2xl font-bold tracking-[-0.04em]">Which products interest you?</h3>
                        <p className="mt-2 text-[12px] text-cream-mute">Select any that apply.</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {interests.map((c) => (
                            <button key={c} type="button" aria-pressed={d.services.includes(c)} onClick={() => toggleService(c)}
                              className={cn("border px-3 py-2 text-[12px] transition-colors", d.services.includes(c) ? "border-red bg-red/15" : "border-line hover:border-cream/40")}>
                              {c}
                            </button>
                          ))}
                        </div>
                        <label htmlFor="req" className="mt-6 block text-[11px] uppercase tracking-[0.18em] text-cream-mute">Tell us about your property or operation</label>
                        <textarea id="req" value={d.requirements} onChange={(e) => set("requirements", e.target.value)} rows={5}
                          placeholder="How many rooms, outlets or branches? What do you use today?"
                          className="mt-2 w-full resize-y border border-line bg-ink p-4 text-sm outline-none focus:border-red" />
                      </div>
                    )}
                    {step === 2 && (
                      <div>
                        <h3 className="text-2xl font-bold tracking-[-0.04em]">Budget & go-live timeline</h3>
                        <div className="mt-6 text-[11px] uppercase tracking-[0.18em] text-cream-mute">Estimated budget</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {budgets.map((b) => <Choice key={b} on={d.budget === b} onClick={() => set("budget", b)}>{b}</Choice>)}
                        </div>
                        <div className="mt-6 text-[11px] uppercase tracking-[0.18em] text-cream-mute">Preferred go-live</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {timelines.map((t) => (
                            <button key={t} type="button" aria-pressed={d.timeline === t} onClick={() => set("timeline", t)}
                              className={cn("border px-3 py-2 text-[12px] transition-colors", d.timeline === t ? "border-red bg-red/15" : "border-line hover:border-cream/40")}>{t}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {step === 3 && (
                      <div>
                        <h3 className="text-2xl font-bold tracking-[-0.04em]">Book a live demo?</h3>
                        <p className="mt-2 text-[12px] text-cream-mute">Optional. We confirm the time by email or phone.</p>
                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                          <Choice on={!wantCall} onClick={() => { setWantCall(false); set("call", null); }}>No call, reply by email</Choice>
                          <Choice on={wantCall} onClick={() => { setWantCall(true); set("call", d.call ?? { date: "", slot: slots[0] }); }}>Yes, book a call</Choice>
                        </div>
                        <AnimatePresence>
                          {wantCall && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease }} className="overflow-hidden">
                              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                <div className="flex flex-col gap-2">
                                  <label htmlFor="cd" className="text-[11px] uppercase tracking-[0.18em] text-cream-mute">Preferred date</label>
                                  <input id="cd" type="date" min={tomorrow} value={d.call?.date ?? ""} onChange={(e) => set("call", { date: e.target.value, slot: d.call?.slot ?? slots[0] })}
                                    className="h-12 border border-line bg-ink px-4 text-sm outline-none [color-scheme:dark] focus:border-red" />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <label htmlFor="cs" className="text-[11px] uppercase tracking-[0.18em] text-cream-mute">Preferred time</label>
                                  <select id="cs" value={d.call?.slot ?? slots[0]} onChange={(e) => set("call", { date: d.call?.date ?? "", slot: e.target.value })}
                                    className="h-12 border border-line bg-ink px-4 text-sm outline-none focus:border-red">
                                    {slots.map((s) => <option key={s}>{s}</option>)}
                                  </select>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    {step === 4 && (
                      <div>
                        <h3 className="text-2xl font-bold tracking-[-0.04em]">Who should we reply to?</h3>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                          <Field id="n" label="Full name *" value={d.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
                          <Field id="c" label="Company" value={d.company} onChange={(e) => set("company", e.target.value)} autoComplete="organization" />
                          <Field id="e" label="Email *" type="email" value={d.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
                          <Field id="p" label="Phone *" type="tel" placeholder="01XXXXXXXXX" value={d.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
                        </div>
                        <p className="mt-5 text-[12px] text-cream-mute">We use your details only to reply to this inquiry.</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div role="alert" className="min-h-6 pt-2 text-[13px] text-red-glow">{err}</div>
                <div className="mt-4 flex items-center justify-between">
                  <Button type="button" variant="ghost" className={cn("px-0", step === 0 && "invisible")} onClick={() => { setErr(""); setStep(step - 1); }}>
                    <ArrowLeft size={14} /> Back
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Sending…" : step === 4 ? "Request demo" : "Continue"} <ArrowRight size={14} />
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </Container>
    </section>
  );
}
