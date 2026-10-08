import { describe, expect, it } from 'vitest';
import type { ProductDto } from '@petra/core';
import { defaultSalePackOf, emptyCart, expandLines, lineBaseQty, lineOk, parseBoxPcs, parseCart, serialiseCart, totalsOf, type CartLine } from './cart';

const p: ProductDto = {
  id: 1, sku: 'MLK', name: 'Milk', nameBn: '', categoryId: null, categoryName: '', brandId: null, brandName: '', baseUnit: 'pcs', trackExpiry: false,
  defaultSalePackId: 12, defaultPurchasePackId: 12, priceRetail: 5_500, priceWholesale: 5_000, priceDealer: 4_800, minPrice: 0, stockQty: 500, stockValue: 0, avgCost: 0, lastCost: 0,
  reorderLevel: 0, favourite: false, status: 'active', notes: '',
  packs: [{ id: 11, name: 'pcs', nameBn: '', factor: 1, priceRetail: null, priceWholesale: null, priceDealer: null, barcode: null }, { id: 12, name: 'Box', nameBn: 'বক্স', factor: 24, priceRetail: 130_000, priceWholesale: 120_000, priceDealer: null, barcode: 'BOX-1' }],
  barcodes: [], hasHistory: false, nearestExpiry: null
};
const byId = new Map([[1, p]]);
const line = (over: Partial<CartLine> = {}): CartLine => ({ key: 1, productId: 1, packId: 12, qty: 2, price: 130_000, discKind: null, discValue: 0, kind: 'normal', pcs: 5, pcsPrice: 5_500, ...over });

describe('POS box + pcs', () => {
  it('reads the shortcut "2b5" and its Bangla and plus forms', () => {
    expect(parseBoxPcs('2b5')).toEqual({ box: 2, pcs: 5 });
    expect(parseBoxPcs('2 box 5 pcs')).toEqual({ box: 2, pcs: 5 });
    expect(parseBoxPcs('২ব৫')).toEqual({ box: 2, pcs: 5 });
    expect(parseBoxPcs('2+5')).toEqual({ box: 2, pcs: 5 });
    expect(parseBoxPcs('7')).toEqual({ box: 7, pcs: null });
    expect(parseBoxPcs('2x')).toBeNull();
  });

  it('starts a new line in the default sale unit', () => {
    expect(defaultSalePackOf(p)).toBe(12);
    expect(defaultSalePackOf({ ...p, defaultSalePackId: null })).toBe(11);
  });

  it('"2 Box 5 Pcs" is two engine lines priced per box and per piece, and the amount adds up exactly', () => {
    const l = line();
    expect(lineBaseQty(p, l)).toBe(53);
    const subs = expandLines([l], byId);
    expect(subs.map((s) => [s.part, s.packId, s.qty, s.price])).toEqual([['box', 12, 2, 130_000], ['pcs', 11, 5, 5_500]]);
    const tot = totalsOf({ ...emptyCart(), lines: [l] }, 0, false, byId);
    expect(tot.amountOf.get(1)).toBe(2 * 130_000 + 5 * 5_500);
    expect(tot.total).toBe(287_500);
  });

  it('a percent discount applies to both parts; a fixed one only to the boxes', () => {
    expect(expandLines([line({ discKind: 'pct', discValue: 500 })], byId).map((s) => s.discValue)).toEqual([500, 500]);
    expect(expandLines([line({ discKind: 'fixed', discValue: 1_000 })], byId).map((s) => s.discValue)).toEqual([1_000, 0]);
    expect(expandLines([line({ qty: 0, discKind: 'fixed', discValue: 1_000 })], byId).map((s) => [s.part, s.discValue])).toEqual([['pcs', 1_000]]);
  });

  it('a line needs some quantity and a price for every part it uses', () => {
    expect(lineOk(p, line())).toBe(true);
    expect(lineOk(p, line({ qty: 0, pcs: 0 }))).toBe(false);
    expect(lineOk(p, line({ pcsPrice: null }))).toBe(false);
    expect(lineOk(p, line({ pcs: 0, pcsPrice: null }))).toBe(true);
    expect(lineOk(p, line({ kind: 'bonus', price: 0, pcsPrice: 0 }))).toBe(true);
  });

  it('keeps box + pcs through the autosaved draft', () => {
    const c = parseCart(serialiseCart({ ...emptyCart(), lines: [line()] }), [p]);
    expect(c?.lines[0]).toMatchObject({ qty: 2, pcs: 5, pcsPrice: 5_500, packId: 12 });
  });
});
