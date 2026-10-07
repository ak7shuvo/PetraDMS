import type { Metadata, Viewport } from "next";
import "@fontsource-variable/jetbrains-mono";
import { LenisProvider } from "@/components/motion/lenis-provider";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.legalName} — Hospitality technology`, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: {
    title: `${site.legalName} — ${site.tagline}`,
    description: site.description,
    type: "website",
    siteName: site.legalName,
  },
  twitter: { card: "summary_large_image", title: site.legalName, description: site.description },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { themeColor: "#121212", colorScheme: "dark" };

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.legalName,
  email: site.email,
  telephone: site.phoneHref,
  description: site.description,
  address: { "@type": "PostalAddress", addressCountry: "BD" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-red focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
