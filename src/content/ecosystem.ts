import type { EcoLayer, EcoNode } from "@/types/content";

export const layers: EcoLayer[] = [
  { id: "guest", label: "Guest Layer", hint: "Where guests find and book" },
  { id: "ops", label: "Operations Layer", hint: "Where the property runs" },
  { id: "intel", label: "Intelligence Layer", hint: "Distribution and decisions" },
  { id: "core", label: "Petra Core Platform", hint: "Shared foundation" },
];

export const nodes: EcoNode[] = [
  { id: "booking", label: "PetraBooking", layer: 0, slot: 0, tier: "module", role: "Direct booking engine" },
  { id: "tour", label: "PetraTour", layer: 0, slot: 1, tier: "module", role: "Tours and packages" },
  { id: "crm", label: "PetraCRM", layer: 0, slot: 2, tier: "module", role: "Guest relationships and loyalty" },

  { id: "pms", label: "PetraPMS", layer: 1, slot: 0, tier: "flagship", code: "PMS", full: "Property Management System", role: "Reservations, rooms, guests and billing" },
  { id: "pos", label: "PetraPOS", layer: 1, slot: 1, tier: "flagship", code: "POS", full: "Point of Sale System", role: "Orders, tables, kitchen and payments" },
  { id: "house", label: "PetraHouse", layer: 1, slot: 2, tier: "module", role: "Housekeeping and maintenance" },
  { id: "events", label: "PetraEvents", layer: 1, slot: 3, tier: "module", role: "Banquets and events" },

  { id: "dms", label: "PetraDMS", layer: 2, slot: 0, tier: "flagship", code: "DMS", full: "Distribution Management System", role: "Sales, stock, partners and reports" },
  { id: "channel", label: "PetraChannel", layer: 2, slot: 1, tier: "module", role: "Channel connectivity" },
  { id: "rms", label: "PetraRMS", layer: 2, slot: 2, tier: "module", role: "Revenue and pricing" },
  { id: "dmo", label: "PetraDMO", layer: 2, slot: 3, tier: "module", role: "Destination organization tools" },

  { id: "api", label: "Core API", layer: 3, slot: 0, tier: "module", role: "Shared APIs for every product" },
  { id: "auth", label: "Authentication", layer: 3, slot: 1, tier: "module", role: "Sign-in and role-based access" },
  { id: "events-bus", label: "Events", layer: 3, slot: 2, tier: "module", role: "Real-time event stream between products" },
  { id: "storage", label: "Storage", layer: 3, slot: 3, tier: "module", role: "Secure data and file storage" },
];

/** Data flows shown when a node is selected. */
export const edges: [string, string][] = [
  ["booking", "pms"], ["tour", "events"], ["crm", "pms"], ["crm", "pos"],
  ["pms", "pos"], ["pms", "house"], ["pos", "events"],
  ["pms", "channel"], ["pms", "dms"], ["pos", "dms"], ["pms", "rms"], ["channel", "dms"], ["dms", "dmo"], ["rms", "channel"],
  ["dms", "api"], ["channel", "auth"], ["rms", "events-bus"], ["dmo", "storage"],
];
