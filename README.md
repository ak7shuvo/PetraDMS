# PETRA — hospitality technology website · build v1.1

Next.js 16 (App Router, RSC) · TypeScript · Tailwind CSS v4 · Framer Motion · GSAP · Lenis · Lucide.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Page structure
Hero → Company Overview → Our Products (PMS, POS, DMS) → Petra Ecosystem → Industries We Serve → Why Petra → CTA (book a demo) → Footer (build version from `src/lib/site.ts`).

## Product screenshots
- `mockups/petradms.html` is the supplied PetraDMS prototype, captured **unmodified**.
- `mockups/petrapms.html` and `mockups/petrapos.html` are generated dashboards built on the same design tokens (`mockups/base.css`) because those products have no prototype yet. The site labels them "Product preview · illustrative data".
- Regenerate all images into `public/products/`:
  ```bash
  pip install playwright pillow && python3 scripts/capture.py          # all
  python3 scripts/capture.py pms                                       # one product
  ```
  When a real PetraPMS/PetraPOS prototype exists, drop it in `mockups/`, point `scripts/capture.py` at it and set `mockup: false` in `src/content/products.ts`.

## Where to edit
- `src/content/` all copy: products, ecosystem nodes and links, industries, why-Petra.
- `src/features/<section>/` one folder per section; `src/components/motion/` reusable motion primitives; `src/components/ui/device-frame.tsx` branded device frames.
- `src/app/api/inquiry/route.ts` validates demo requests (+ honeypot) and forwards them.

## Before going live
1. Set `INQUIRY_WEBHOOK_URL` (Slack/Zapier/Make/CRM). Without it requests are only logged and the visitor is prompted to email.
2. Set `NEXT_PUBLIC_SITE_URL` for canonical, sitemap and OG tags; add an OG image.
3. Review the ecosystem module descriptions and the industry-to-product mapping in `src/content/` and mark any module that is not yet released.
