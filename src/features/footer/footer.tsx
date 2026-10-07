import { Container } from "@/shared/section";
import { site, nav } from "@/lib/site";
import { products } from "@/content/products";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line bg-ink pt-20">
      <Container>
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="text-[15px] font-bold tracking-[0.3em]">{site.name}</div>
            <p className="mt-5 max-w-[40ch] text-[13px] leading-relaxed text-cream-dim">
              {site.legalName} builds hospitality technology in Bangladesh: {site.tagline.toLowerCase()}
            </p>
          </div>
          <nav aria-label="Products">
            <div className="text-[11px] uppercase tracking-[0.22em] text-cream-mute">Products</div>
            <ul className="mt-5 flex flex-col gap-3 text-[13px]">
              {products.map((p) => (
                <li key={p.code}>
                  <a href="#products" className="text-cream-dim hover:text-cream">{p.name}</a>
                  <span className="block text-[11px] text-cream-mute">{p.full}</span>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Footer">
            <div className="text-[11px] uppercase tracking-[0.22em] text-cream-mute">Explore</div>
            <ul className="mt-5 flex flex-col gap-3 text-[13px]">
              {nav.map((n) => <li key={n.href}><a href={n.href} className="text-cream-dim hover:text-cream">{n.label}</a></li>)}
              <li><a href="#contact" className="text-cream-dim hover:text-cream">Book a demo</a></li>
            </ul>
          </nav>
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-cream-mute">Contact</div>
            <ul className="mt-5 flex flex-col gap-3 text-[13px]">
              <li><a href={`mailto:${site.email}`} className="break-all text-cream-dim hover:text-cream">{site.email}</a></li>
              <li><a href={`tel:${site.phoneHref}`} className="text-cream-dim hover:text-cream">{site.phone}</a></li>
              <li className="text-cream-dim">{site.country}</li>
            </ul>
          </div>
        </div>
      </Container>
      <div aria-hidden className="mt-20 select-none text-center text-[clamp(5rem,25vw,24rem)] font-extrabold leading-[0.75] tracking-[-0.08em] text-cream/[0.05]">PETRA</div>
      <div className="border-t border-line">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-6 text-[12px] text-cream-mute">
          <span>© {new Date().getFullYear()} {site.legalName}. All rights reserved.</span>
          <span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-red" />Build version {site.version}</span>
        </Container>
      </div>
    </footer>
  );
}
