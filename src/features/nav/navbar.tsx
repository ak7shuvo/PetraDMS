"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { nav, site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";

function Logo() {
  return (
    <a href="#top" aria-label="PETRA home" className="flex items-center gap-3">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <path d="M16 2 29 9.5v13L16 30 3 22.5v-13z" fill="#C8202F" />
        <path d="M11 22V10h6.2a4.3 4.3 0 0 1 0 8.6H11" fill="none" stroke="#F6F1E7" strokeWidth="2.6" strokeLinejoin="round" />
      </svg>
      <span className="text-[15px] font-bold tracking-[0.3em]">{site.name}</span>
    </a>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1, ease, delay: 0.2 }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-500",
        scrolled || open ? "border-b border-line bg-ink/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-9 lg:flex">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="text-[12px] uppercase tracking-[0.16em] text-cream-dim transition-colors hover:text-cream">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="#contact"
            className="hidden h-10 items-center bg-cream px-5 text-[12px] font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:bg-red hover:text-cream sm:inline-flex"
          >
            Book a demo
          </a>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center border border-line lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label="Mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease }}
            className="overflow-hidden border-t border-line lg:hidden"
          >
            <div className="flex flex-col px-5 py-4">
              {[...nav, { label: "Book a demo", href: "#contact" }].map((n) => (
                <a key={n.href + n.label} href={n.href} onClick={() => setOpen(false)} className="border-b border-line py-4 text-sm uppercase tracking-[0.16em]">
                  {n.label}
                </a>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
