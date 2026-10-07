import type { ProductCode } from "@/types/content";

export type Industry = {
  name: string;
  icon: "hotel" | "palm" | "utensils" | "compass" | "landmark";
  line: string;
  products: ProductCode[];
  module?: string;
};

export const industries: Industry[] = [
  { name: "Hotels", icon: "hotel", line: "Front desk to dining room, one system.", products: ["PMS", "POS", "DMS"] },
  { name: "Resorts", icon: "palm", line: "Many outlets, one guest folio.", products: ["PMS", "POS", "DMS"] },
  { name: "Restaurants", icon: "utensils", line: "Tables, kitchen and payments in sync.", products: ["POS"] },
  { name: "Tour Operators", icon: "compass", line: "Partners, suppliers and dues in view.", products: ["DMS"], module: "PetraTour" },
  { name: "DMOs", icon: "landmark", line: "Visibility across a destination's network.", products: ["DMS"], module: "PetraDMO" },
];
