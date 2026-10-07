import { NextResponse } from "next/server";
import type { Inquiry, InquiryResponse } from "@/types/inquiry";

export const runtime = "nodejs";

function makeRef() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => letters[b % letters.length]).join("");
  return `INQ-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let raw: Partial<Inquiry>;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json<InquiryResponse>({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: pretend success so bots learn nothing.
  if (raw.website) return NextResponse.json<InquiryResponse>({ ok: true, ref: makeRef(), delivered: true });

  const data = {
    projectType: str(raw.projectType, 80),
    services: Array.isArray(raw.services) ? raw.services.slice(0, 12).map((s) => str(s, 80)) : [],
    requirements: str(raw.requirements, 4000),
    budget: str(raw.budget, 80),
    timeline: str(raw.timeline, 80),
    call: raw.call && typeof raw.call === "object" ? { date: str(raw.call.date, 20), slot: str(raw.call.slot, 40) } : null,
    name: str(raw.name, 120),
    company: str(raw.company, 160),
    email: str(raw.email, 200),
    phone: str(raw.phone, 40),
  };

  if (!data.name) return NextResponse.json<InquiryResponse>({ ok: false, error: "Name is required." }, { status: 422 });
  if (!/^\S+@\S+\.\S{2,}$/.test(data.email)) return NextResponse.json<InquiryResponse>({ ok: false, error: "A valid email is required." }, { status: 422 });
  if (data.phone.replace(/\D/g, "").length < 10) return NextResponse.json<InquiryResponse>({ ok: false, error: "A valid phone number is required." }, { status: 422 });
  if (data.requirements.length < 10) return NextResponse.json<InquiryResponse>({ ok: false, error: "Please describe your requirements." }, { status: 422 });

  const ref = makeRef();
  const payload = { ref, receivedAt: new Date().toISOString(), ...data };

  // Delivery: forward to a webhook (Slack, Zapier, Make, your CRM...) when configured.
  const hook = process.env.INQUIRY_WEBHOOK_URL;
  let delivered = false;
  if (hook) {
    try {
      const r = await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      delivered = r.ok;
    } catch {
      delivered = false;
    }
  }
  if (!delivered) console.info("[inquiry]", JSON.stringify(payload));

  return NextResponse.json<InquiryResponse>({ ok: true, ref, delivered });
}
