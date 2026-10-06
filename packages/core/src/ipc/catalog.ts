import { z } from 'zod';
import { ch, dateStr, id, none } from './define';

// ===== DTOs =====
export interface PackDto {
  id: number;
  name: string;
  nameBn: string;
  factor: number;
  priceRetail: number | null;
  priceWholesale: number | null;
  priceDealer: number | null;
}

export interface ProductDto {
  id: number;
  sku: string;
  name: string;
  nameBn: string;
  categoryId: number | null;
  categoryName: string;
  brandId: number | null;
  brandName: string;
  baseUnit: string;
  trackExpiry: boolean;
  /** Selling prices are per ONE base unit, in poisha. */
  priceRetail: number;
  priceWholesale: number;
  priceDealer: number;
  minPrice: number;
  stockQty: number;
  /** Cost fields are null for Staff (plan 13.1). */
  stockValue: number | null;
  avgCost: number | null;
  lastCost: number | null;
  reorderLevel: number;
  favourite: boolean;
  status: 'active' | 'archived';
  notes: string;
  packs: PackDto[];
  barcodes: string[];
  hasHistory: boolean;
  nearestExpiry: string | null;
}

export interface LookupDto {
  id: number;
  name: string;
  nameBn: string;
  status: 'active' | 'archived';
}

export interface SupplierDto {
  id: number;
  name: string;
  nameBn: string;
  phone: string;
  address: string;
  /** Positive = we owe the supplier. */
  balance: number;
  status: 'active' | 'archived';
  notes: string;
}

export interface MoneyAccountDto {
  id: number;
  name: string;
  nameBn: string;
  kind: string;
  balance: number;
  isDefault: boolean;
}

export interface LedgerRow {
  id: number;
  date: string;
  kind: string;
  amount: number;
  balanceAfter: number;
  note: string;
  refType: string | null;
  refId: number | null;
  refNo: string;
  reversal: boolean;
}

export interface LedgerView {
  party: { id: number; name: string; balance: number; phone: string };
  rows: LedgerRow[];
}

export interface PurchaseListItem {
  id: number;
  docNo: string;
  date: string;
  supplierId: number | null;
  supplierName: string;
  supplierRef: string;
  total: number;
  paid: number;
  due: number;
  status: 'posted' | 'void';
  itemCount: number;
}

export interface PurchaseItemDto {
  lineNo: number;
  productId: number;
  sku: string;
  productName: string;
  packName: string;
  factor: number;
  qty: number;
  baseQty: number;
  unitCost: number;
  amount: number;
  batchNo: string;
  expiry: string | null;
  batchId: number | null;
}

export interface PurchaseDetail extends PurchaseListItem {
  subtotal: number;
  discount: number;
  note: string;
  accountId: number | null;
  voidReason: string | null;
  items: PurchaseItemDto[];
  returns: { id: number; docNo: string; date: string; credit: number; status: 'posted' | 'void' }[];
}

export interface StockMovementRow {
  id: number;
  date: string;
  kind: string;
  baseQty: number;
  balanceQty: number;
  value: number | null;
  refType: string | null;
  refId: number | null;
  refNo: string;
  batchNo: string;
  note: string;
  reversal: boolean;
}

export interface BatchDto {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  batchNo: string;
  expiry: string | null;
  qty: number;
  daysToExpiry: number | null;
  state: 'expired' | 'soon' | 'ok' | 'none';
}

export interface StockAlerts {
  low: { productId: number; sku: string; name: string; stockQty: number; reorderLevel: number; baseUnit: string }[];
  expiring: BatchDto[];
  expired: BatchDto[];
}

export interface AdjustmentListItem {
  id: number;
  docNo: string;
  date: string;
  productId: number;
  sku: string;
  productName: string;
  kind: string;
  baseQty: number;
  value: number | null;
  reason: string;
  status: 'posted' | 'void';
}

// ===== Inputs =====
const poisha = z.number().int().min(0).max(9_000_000_000_000);
const qty = z.number().int().positive().max(1_000_000_000);
const optPrice = z.number().int().min(0).nullable().optional();

export const packInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(40),
  nameBn: z.string().trim().max(40).default(''),
  factor: z.number().int().min(2).max(100000),
  priceRetail: optPrice,
  priceWholesale: optPrice,
  priceDealer: optPrice
});

export const productSaveInput = z.object({
  id: z.number().int().positive().optional(),
  sku: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  nameBn: z.string().trim().max(160).default(''),
  categoryId: z.number().int().positive().nullable().default(null),
  brandId: z.number().int().positive().nullable().default(null),
  baseUnit: z.string().trim().min(1).max(20).default('pcs'),
  trackExpiry: z.boolean().default(false),
  priceRetail: poisha,
  priceWholesale: poisha,
  priceDealer: poisha,
  minPrice: poisha.default(0),
  reorderLevel: z.number().int().min(0).max(1_000_000_000).default(0),
  favourite: z.boolean().default(false),
  notes: z.string().trim().max(500).default(''),
  /** Extra pack levels above the base unit (the base pack is created and kept automatically). */
  packs: z.array(packInput).max(8).default([]),
  barcodes: z.array(z.string().trim().min(3).max(40)).max(10).default([])
});

export const lookupSaveInput = z.object({
  kind: z.enum(['category', 'brand']),
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(80),
  nameBn: z.string().trim().max(80).default(''),
  archived: z.boolean().optional()
});

export const supplierSaveInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(120),
  nameBn: z.string().trim().max(120).default(''),
  phone: z.string().trim().max(40).default(''),
  address: z.string().trim().max(300).default(''),
  notes: z.string().trim().max(500).default(''),
  /** Only when creating: what we already owe this supplier. */
  openingBalance: poisha.optional(),
  openingDate: dateStr.optional(),
  archived: z.boolean().optional()
});

export const purchaseSaveInput = z.object({
  supplierId: z.number().int().positive().nullable().default(null),
  supplierRef: z.string().trim().max(60).default(''),
  date: dateStr,
  lines: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        packId: z.number().int().positive().nullable().default(null),
        qty,
        unitCost: poisha,
        batchNo: z.string().trim().max(40).default(''),
        expiry: dateStr.nullable().default(null)
      })
    )
    .min(1)
    .max(300),
  discount: poisha.default(0),
  paid: poisha.default(0),
  accountId: z.number().int().positive().nullable().default(null),
  note: z.string().trim().max(300).default('')
});

export const purchaseReturnInput = z.object({
  supplierId: z.number().int().positive().nullable().default(null),
  purchaseId: z.number().int().positive().nullable().default(null),
  date: dateStr,
  lines: z.array(z.object({ productId: z.number().int().positive(), baseQty: qty, credit: poisha, batchId: z.number().int().positive().nullable().default(null) })).min(1).max(100),
  refundMode: z.enum(['due', 'cash']),
  accountId: z.number().int().positive().nullable().default(null),
  reason: z.string().trim().max(300).default('')
});

export const paymentSaveInput = z.object({
  partyKind: z.enum(['customer', 'supplier']),
  partyId: z.number().int().positive(),
  amount: z.number().int().positive().max(9_000_000_000_000),
  date: dateStr,
  accountId: z.number().int().positive().nullable().default(null),
  reference: z.string().trim().max(60).default(''),
  note: z.string().trim().max(300).default('')
});

export const adjustInput = z.object({
  productId: z.number().int().positive(),
  kind: z.enum(['opening', 'adjust_in', 'adjust_out', 'damage', 'expired', 'internal_use']),
  baseQty: qty,
  date: dateStr,
  reason: z.string().trim().max(300).default(''),
  /** Total value in poisha for `opening` and `adjust_in`. Omit to use the average cost. */
  value: poisha.optional(),
  batch: z.object({ batchNo: z.string().trim().max(40).default(''), expiry: dateStr.nullable().default(null) }).optional(),
  batchId: z.number().int().positive().nullable().optional()
});

const range = z.object({ from: dateStr.optional(), to: dateStr.optional() });

export const catalogChannels = {
  'catalog:products': ch<ProductDto[]>()(z.object({ includeArchived: z.boolean().default(false) })),
  'catalog:productSave': ch<{ id: number }>()(productSaveInput, { access: 'manager', write: true }),
  'catalog:productArchive': ch()(z.object({ id: z.number().int().positive(), archived: z.boolean() }), { access: 'manager', write: true }),
  'catalog:lookups': ch<{ categories: LookupDto[]; brands: LookupDto[] }>()(none),
  'catalog:lookupSave': ch<{ id: number }>()(lookupSaveInput, { access: 'manager', write: true }),
  'catalog:suppliers': ch<SupplierDto[]>()(z.object({ includeArchived: z.boolean().default(false) }), { access: 'manager' }),
  'catalog:supplierSave': ch<{ id: number }>()(supplierSaveInput, { access: 'manager', write: true }),

  'money:accounts': ch<MoneyAccountDto[]>()(none),
  'party:ledger': ch<LedgerView>()(z.object({ kind: z.enum(['customer', 'supplier', 'employee']), id: z.number().int().positive(), from: dateStr.optional(), to: dateStr.optional() })),
  'payment:save': ch<{ id: number; docNo: string }>()(paymentSaveInput, { write: true }),
  'payment:void': ch()(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(1).max(300) }), { access: 'manager', write: true }),

  'purchase:save': ch<{ id: number; docNo: string; total: number; paid: number; due: number }>()(purchaseSaveInput, { access: 'manager', write: true }),
  'purchase:list': ch<PurchaseListItem[]>()(range.extend({ supplierId: z.number().int().positive().optional(), search: z.string().max(60).optional() }), { access: 'manager' }),
  'purchase:get': ch<PurchaseDetail>()(id, { access: 'manager' }),
  'purchase:void': ch()(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(1).max(300) }), { access: 'manager', write: true }),
  'purchase:return': ch<{ id: number; docNo: string; credit: number; costValue: number; variance: number }>()(purchaseReturnInput, { access: 'manager', write: true }),
  'purchase:returnVoid': ch()(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(1).max(300) }), { access: 'manager', write: true }),

  'stock:movements': ch<StockMovementRow[]>()(range.extend({ productId: z.number().int().positive(), limit: z.number().int().min(1).max(2000).default(500) }), { access: 'manager' }),
  'stock:batches': ch<BatchDto[]>()(z.object({ productId: z.number().int().positive().optional(), includeEmpty: z.boolean().default(false) })),
  'stock:alerts': ch<StockAlerts>()(z.object({ soonDays: z.number().int().min(1).max(365).default(30) })),
  'stock:adjust': ch<{ id: number; docNo: string; value: number }>()(adjustInput, { access: 'manager', write: true }),
  'stock:adjustments': ch<AdjustmentListItem[]>()(range, { access: 'manager' }),
  'stock:adjustVoid': ch()(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(1).max(300) }), { access: 'manager', write: true })
};
