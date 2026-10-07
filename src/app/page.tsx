import { Navbar } from "@/features/nav/navbar";
import { Hero } from "@/features/hero/hero";
import { Overview } from "@/features/overview/overview";
import { Products } from "@/features/products/products";
import { Ecosystem } from "@/features/ecosystem/ecosystem";
import { Industries } from "@/features/industries/industries";
import { Why } from "@/features/why/why";
import { Contact } from "@/features/contact/contact";
import { Footer } from "@/features/footer/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main">
        <Hero />
        <Overview />
        <Products />
        <Ecosystem />
        <Industries />
        <Why />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
