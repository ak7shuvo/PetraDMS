import { Section } from "@/shared/section";
import { products } from "@/content/products";
import { ProductShowcase } from "./product-showcase";

export function Products() {
  return (
    <Section
      id="products"
      index="03"
      eyebrow="Our products"
      title="Three products. One ecosystem."
      lede="PetraPMS runs the property, PetraPOS runs the outlets, and PetraDMS runs distribution. Each works alone; together they share data."
    >
      <div className="flex flex-col gap-6 sm:gap-8">
        {products.map((p, i) => (
          <ProductShowcase key={p.code} product={p} index={i} />
        ))}
      </div>
    </Section>
  );
}
