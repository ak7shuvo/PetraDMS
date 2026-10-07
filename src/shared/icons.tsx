import {
  BarChart3, BedDouble, Boxes, Building2, CalendarDays, Calculator, Compass, Flame, Hotel, Landmark,
  Layers, LifeBuoy, Network, Palmtree, Receipt, Server, Sparkles, Store, Truck, UtensilsCrossed, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ProductCode } from "@/types/content";

const map: Record<string, LucideIcon> = {
  calendar: CalendarDays, bed: BedDouble, receipt: Receipt, sparkles: Sparkles, network: Network,
  utensils: UtensilsCrossed, flame: Flame, chart: BarChart3, wallet: Wallet, boxes: Boxes, users: Users,
  calc: Calculator, server: Server, life: LifeBuoy, layers: Layers, hotel: Hotel, palm: Palmtree,
  compass: Compass, landmark: Landmark,
};

export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const C = map[name] ?? Layers;
  return <C size={size} className={className} aria-hidden />;
}

export const productIcon: Record<ProductCode, LucideIcon> = { PMS: Building2, POS: Store, DMS: Truck };
