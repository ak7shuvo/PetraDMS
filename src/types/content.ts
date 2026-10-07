export type ProductCode = "PMS" | "POS" | "DMS";

export type Screen = { id: string; label: string; src: string; alt: string };

export type Product = {
  code: ProductCode;
  name: string; // PetraPMS
  full: string; // Property Management System
  tagline: string; // very short, for chips
  description: string;
  features: { icon: string; title: string }[];
  screens: Screen[];
  device: "laptop" | "tablet";
  /** true when the screens are generated mockups rather than the supplied prototype */
  mockup: boolean;
};

export type EcoNode = {
  id: string;
  label: string;
  layer: 0 | 1 | 2 | 3;
  slot: number;
  tier: "flagship" | "module";
  code?: ProductCode;
  full?: string;
  role: string;
};

export type EcoLayer = { id: string; label: string; hint: string };
