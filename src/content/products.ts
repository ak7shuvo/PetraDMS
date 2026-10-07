import type { Product } from "@/types/content";

const s = (id: string, label: string, alt: string) => ({ id, label, src: `/products/${id}.webp`, alt });

export const products: Product[] = [
  {
    code: "PMS",
    name: "PetraPMS",
    full: "Property Management System",
    tagline: "Rooms · Guests · Billing",
    description:
      "A complete hotel and resort operations platform covering reservations, guest management, room inventory, billing, check-in and check-out workflows.",
    features: [
      { icon: "calendar", title: "Reservations & front desk" },
      { icon: "bed", title: "Live room inventory" },
      { icon: "receipt", title: "Guest folios & billing" },
      { icon: "sparkles", title: "Housekeeping status" },
      { icon: "network", title: "Runs on the hotel LAN" },
    ],
    device: "laptop",
    mockup: true,
    screens: [
      s("pms-dashboard", "Dashboard", "PetraPMS dashboard showing occupancy, arrivals, departures and room status"),
      s("pms-rooms", "Rooms", "PetraPMS room floor plan with live room status"),
      s("pms-billing", "Billing", "PetraPMS guest folio with charges, deposit and settlement"),
    ],
  },
  {
    code: "POS",
    name: "PetraPOS",
    full: "Point of Sale System",
    tagline: "Orders · Tables · Payments",
    description:
      "Restaurant, café, room-service, and hospitality sales management platform with real-time order handling and operational analytics.",
    features: [
      { icon: "utensils", title: "Table & order management" },
      { icon: "flame", title: "Kitchen display" },
      { icon: "bed", title: "Room charge to PMS" },
      { icon: "chart", title: "Live sales analytics" },
      { icon: "wallet", title: "Cash, card and bKash" },
    ],
    device: "tablet",
    mockup: true,
    screens: [
      s("pos-terminal", "Terminal", "PetraPOS order terminal with menu and table ticket"),
      s("pos-analytics", "Analytics", "PetraPOS sales analytics with hourly sales and payment mix"),
      s("pos-kitchen", "Kitchen", "PetraPOS kitchen display with live order tickets"),
    ],
  },
  {
    code: "DMS",
    name: "PetraDMS",
    full: "Distribution Management System",
    tagline: "Sales · Stock · Partners",
    description:
      "Run distribution operations from one desk: sales and invoicing, purchasing, multi-unit inventory, customer and supplier ledgers, with daily reports and operational visibility.",
    features: [
      { icon: "receipt", title: "Invoicing with due tracking" },
      { icon: "boxes", title: "Big box · small box · piece stock" },
      { icon: "users", title: "Customer & supplier ledgers" },
      { icon: "chart", title: "Daily to monthly reports" },
      { icon: "calc", title: "Compact mode with calculator" },
    ],
    device: "laptop",
    mockup: false,
    screens: [
      s("dms-dashboard", "Dashboard", "PetraDMS dashboard with sales, collection, dues, stock and recent invoices"),
      s("dms-inventory", "Inventory", "PetraDMS inventory screen with stock levels and movements"),
      s("dms-reports", "Reports", "PetraDMS profit and margin report"),
      s("dms-compact", "Compact mode", "PetraDMS compact mode with built-in calculator and quick actions"),
    ],
  },
];

export const productByCode = Object.fromEntries(products.map((p) => [p.code, p])) as Record<string, (typeof products)[number]>;
