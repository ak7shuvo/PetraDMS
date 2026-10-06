import { computeInvoice, type CustomerDto, type InvoiceResult, type PriceTier, type ProductDto } from '@petra/core';

export interface CartLine {
  key: number;
  productId: number;
  packId: number;
  qty: number | null;
  /** Price per ONE unit of the chosen pack, in poisha. */
  price: number | null;
  discKind: 'pct' | 'fixed' | null;
  /** pct: basis points. fixed: poisha. */
  discValue: number;
  kind: 'normal' | 'bonus';
}

export interface CartState {
  customerId: number | null;
  lines: CartLine[];
  discKind: 'pct' | 'fixed' | null;
  discValue: number;
  /** null = untouched, follow the default. */
  paid: number | null;
  accountId: number | null;
  note: string;
}

export const emptyCart = (): CartState => ({ customerId: null, lines: [], discKind: null, discValue: 0, paid: null, accountId: null, note: '' });

export function baseQtyOf(p: ProductDto, packId: number, qty: number | null): number {
  const pack = p.packs.find((k) => k.id === packId);
  return (qty ?? 0) * (pack?.factor ?? 1);
}

/** Tier price per ONE unit of a pack: the pack's own price when set, otherwise the per-base price times the factor. */
export function tierPriceOf(p: ProductDto, packId: number, tier: PriceTier): number {
  const pack = p.packs.find((k) => k.id === packId) ?? p.packs[0];
  const base = tier === 'retail' ? p.priceRetail : tier === 'wholesale' ? p.priceWholesale : p.priceDealer;
  if (!pack) return base;
  const own = tier === 'retail' ? pack.priceRetail : tier === 'wholesale' ? pack.priceWholesale : pack.priceDealer;
  return own ?? base * pack.factor;
}

export function basePackOf(p: ProductDto): number {
  return (p.packs.find((k) => k.factor === 1) ?? p.packs[0])!.id;
}

export function customerTier(c: CustomerDto | null): PriceTier {
  return c?.type ?? 'retail';
}

export function totalsOf(cart: CartState, taxBp: number, roundOff: boolean): InvoiceResult {
  return computeInvoice({
    lines: cart.lines.map((l) => ({ kind: l.kind, qty: l.qty ?? 0, price: l.kind === 'bonus' ? 0 : l.price ?? 0, discKind: l.kind === 'bonus' ? null : l.discKind, discValue: l.discValue })),
    discKind: cart.discKind,
    discValue: cart.discValue,
    taxBp,
    roundOff
  });
}

/** Draft payload stored in `sale_drafts`; restored defensively because products may have changed since. */
export function serialiseCart(c: CartState): string {
  return JSON.stringify({ v: 1, ...c, lines: c.lines.map((l) => ({ ...l })) });
}

export function parseCart(payload: string, products: ProductDto[]): CartState | null {
  try {
    const raw = JSON.parse(payload) as Partial<CartState> & { v?: number };
    if (raw.v !== 1 || !Array.isArray(raw.lines)) return null;
    const lines: CartLine[] = [];
    let key = 1;
    for (const l of raw.lines) {
      const p = products.find((x) => x.id === l.productId);
      if (!p || p.status !== 'active') continue;
      const packId = p.packs.some((k) => k.id === l.packId) ? l.packId : basePackOf(p);
      lines.push({ key: key++, productId: p.id, packId, qty: typeof l.qty === 'number' ? l.qty : 1, price: typeof l.price === 'number' ? l.price : null, discKind: l.discKind ?? null, discValue: l.discValue ?? 0, kind: l.kind === 'bonus' ? 'bonus' : 'normal' });
    }
    return { customerId: typeof raw.customerId === 'number' ? raw.customerId : null, lines, discKind: raw.discKind ?? null, discValue: raw.discValue ?? 0, paid: typeof raw.paid === 'number' ? raw.paid : null, accountId: raw.accountId ?? null, note: raw.note ?? '' };
  } catch {
    return null;
  }
}

/** Total base quantity of a product across the normal and bonus lines (for the stock warning). */
export function demandFor(cart: CartState, products: Map<number, ProductDto>, productId: number): number {
  const p = products.get(productId);
  if (!p) return 0;
  return cart.lines.filter((l) => l.productId === productId).reduce((a, l) => a + baseQtyOf(p, l.packId, l.qty), 0);
}
