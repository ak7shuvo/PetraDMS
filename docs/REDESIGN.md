# PETRA — Redesign Proposal

## 1. Audit of the current site (PetraWeb.html)

**Architecture**
- One 600-line static HTML file: CSS, markup and JS in a single document. No components, no content layer, no build step, nothing reusable.
- Content is hard-coded in markup (and industries in an inline JS array), so every copy change means editing HTML.
- Inquiries are saved to `localStorage` and then handed to a `mailto:` link. Leads never reach a server, so they are effectively lost unless the visitor sends the email themselves.

**Design**
- Blue/white SaaS palette with Geist. Clean, but interchangeable with thousands of templates; no ownable identity.
- Hero is a faux dashboard built from divs; it reads as a stock illustration, not as proof of engineering.
- Case "screenshots" are identical bar charts, so the portfolio shows no actual work.
- Fixed `1200px` column and one rhythm (112px sections) all the way down, so there is no pacing or cinematic moment.

**Motion**
- CSS keyframes only: a fade-up on load and a float loop. Nothing is scroll-aware, nothing responds to the pointer.

**UX**
- The contact form is a 14-field single page. High friction, no progressive disclosure, no completion moment.
- Two CTAs ("Book a Consultation" / "View Services") do not match the intent hierarchy for enterprise buyers.

**Trust**
- No trusted-by, testimonials, or measured outcomes (correctly, since none are verified). The new design must create trust through craft and specificity rather than fabricated logos.

## 2. New architecture

```
src/
  app/            layout, page (RSC), sitemap, robots, opengraph
  components/ui/  shadcn-style primitives (Button, Badge, Accordion)
  components/motion/  Reveal, SplitText, Magnetic, Parallax, Marquee, Counter
  features/       one folder per section: hero, trust, overview, capabilities,
                  industries, stack, process, work, architecture, ai, why,
                  metrics, faq, contact, footer
  shared/         Section, SectionHeader, Mono label, Container
  lib/            cn(), motion presets, lenis provider, site config
  hooks/          useMousePosition, useReducedMotion, useInView
  types/          content types
  content/        all copy as typed data (services, industries, stack, faq, ...)
```
Server Components render static content; only motion/interactive leaves are `"use client"`.

## 3. UX improvements
- Primary CTA **Start Your Project**, secondary **View Case Studies** (as specified).
- Contact becomes a 4-step guided flow (type → scope → budget/timeline → details), then discovery-call slot picker and animated confirmation. Fields are revealed progressively.
- Real lead delivery through a route handler (`/api/inquiry`) with validation, honeypot and a pluggable provider (email/webhook), instead of `mailto`.

## 4. Motion strategy
- **Lenis** for smooth scroll, driven by GSAP ticker.
- **GSAP ScrollTrigger** for pinned/scrubbed hero depth and the process timeline.
- **Framer Motion** for reveals, layout transitions, magnetic buttons and the contact flow.
- One rule: motion explains structure (depth, sequence, relationship). Everything respects `prefers-reduced-motion`.

## 5. Design system
- Colours: Black `#121212` (80%), Cream `#F6F1E7` (15%), Red `#C8202F` (5%, accent only).
- Type: JetBrains Mono throughout; huge tight display sizes, monospace labels, oversized numerals.
- Dark native; cream used for contrast bands and type.
- Tokens declared once in Tailwind v4 `@theme`.

## 6. Content integrity
Real: services, industries, stack, process, products (PetraPOS, PetraPMS), contact details, 30·30·40 billing, 3-month bug-fix support.
Not invented: client logos, testimonials, revenue/impact numbers. Those sections are built as honest equivalents (sectors served, products, engagement model) with typed content slots ready for verified data.
