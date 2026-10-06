import { PetraError, type AdjustmentListItem, type BatchDto, type PurchaseDetail, type PurchaseListItem, type Role, type StockAlerts, type StockMovementRow } from '@petra/core';
import { daysBetween } from '@petra/core';
import { all, get } from '../sql';
import { type Ctx, requireRow } from '../ctx';
import { docKey, docNumbers } from './docref';

export function listPurchases(ctx: Ctx, f: { from?: string; to?: string; supplierId?: number; search?: string }): PurchaseListItem[] {
  const q = f.search ? `%${f.search.trim().toLowerCase()}%` : null;
  return all<{ id: number; doc_no: string; business_date: string; supplier_id: number | null; supplier_name: string | null; supplier_ref: string; total: number; paid: number; due: number; status: 'posted' | 'void'; item_count: number }>(
    ctx.db,
    `SELECT p.id, p.doc_no, p.business_date, p.supplier_id, s.name AS supplier_name, p.supplier_ref, p.total, p.paid, p.due, p.status,
            (SELECT COUNT(*) FROM purchase_items i WHERE i.purchase_id = p.id) AS item_count
       FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE (? IS NULL OR p.business_date >= ?) AND (? IS NULL OR p.business_date <= ?) AND (? IS NULL OR p.supplier_id = ?)
        AND (? IS NULL OR lower(p.doc_no) LIKE ? OR lower(p.supplier_ref) LIKE ? OR lower(COALESCE(s.name,'')) LIKE ?)
      ORDER BY p.business_date DESC, p.id DESC LIMIT 2000`,
    f.from ?? null, f.from ?? null, f.to ?? null, f.to ?? null, f.supplierId ?? null, f.supplierId ?? null, q, q, q, q
  ).map((r) => ({ id: r.id, docNo: r.doc_no, date: r.business_date, supplierId: r.supplier_id, supplierName: r.supplier_name ?? '', supplierRef: r.supplier_ref, total: r.total, paid: r.paid, due: r.due, status: r.status, itemCount: r.item_count }));
}

export function getPurchase(ctx: Ctx, id: number): PurchaseDetail {
  const p = requireRow(
    get<{ id: number; doc_no: string; business_date: string; supplier_id: number | null; supplier_name: string | null; supplier_ref: string; subtotal: number; discount: number; total: number; paid: number; due: number; status: 'posted' | 'void'; note: string; account_id: number | null; void_reason: string | null }>(
      ctx.db, 'SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?', id
    ), 'purchase', id
  );
  const items = all<{ line_no: number; product_id: number; sku: string; name: string; pack_name: string; factor: number; qty: number; base_qty: number; unit_cost: number; amount: number; batch_no: string; expiry_date: string | null; batch_id: number | null }>(
    ctx.db, 'SELECT i.line_no, i.product_id, pr.sku, pr.name, i.pack_name, i.factor, i.qty, i.base_qty, i.unit_cost, i.amount, i.batch_no, i.expiry_date, i.batch_id FROM purchase_items i JOIN products pr ON pr.id = i.product_id WHERE i.purchase_id = ? ORDER BY i.line_no', id
  );
  const returns = all<{ id: number; doc_no: string; business_date: string; credit: number; status: 'posted' | 'void' }>(ctx.db, 'SELECT id, doc_no, business_date, credit, status FROM purchase_returns WHERE purchase_id = ? ORDER BY id', id);
  return {
    id: p.id, docNo: p.doc_no, date: p.business_date, supplierId: p.supplier_id, supplierName: p.supplier_name ?? '', supplierRef: p.supplier_ref, total: p.total, paid: p.paid, due: p.due, status: p.status,
    itemCount: items.length, subtotal: p.subtotal, discount: p.discount, note: p.note, accountId: p.account_id, voidReason: p.void_reason,
    items: items.map((i) => ({ lineNo: i.line_no, productId: i.product_id, sku: i.sku, productName: i.name, packName: i.pack_name, factor: i.factor, qty: i.qty, baseQty: i.base_qty, unitCost: i.unit_cost, amount: i.amount, batchNo: i.batch_no, expiry: i.expiry_date, batchId: i.batch_id })),
    returns: returns.map((r) => ({ id: r.id, docNo: r.doc_no, date: r.business_date, credit: r.credit, status: r.status }))
  };
}

export function stockMovements(ctx: Ctx, role: Role, f: { productId: number; from?: string; to?: string; limit: number }): StockMovementRow[] {
  requireRow(get(ctx.db, 'SELECT id FROM products WHERE id = ?', f.productId), 'product', f.productId);
  const rows = all<{ id: number; business_date: string; kind: string; base_qty: number; value: number; ref_type: string | null; ref_id: number | null; reverses_id: number | null; note: string; batch_no: string | null }>(
    ctx.db,
    `SELECT m.id, m.business_date, m.kind, m.base_qty, m.value, m.ref_type, m.ref_id, m.reverses_id, m.note, b.batch_no
       FROM stock_movements m LEFT JOIN stock_batches b ON b.id = m.batch_id WHERE m.product_id = ? ORDER BY m.id`, f.productId
  );
  const docs = docNumbers(ctx.db, rows.map((r) => ({ refType: r.ref_type, refId: r.ref_id })));
  let bal = 0;
  const out: StockMovementRow[] = rows.map((r) => {
    bal += r.base_qty;
    return { id: r.id, date: r.business_date, kind: r.kind, baseQty: r.base_qty, balanceQty: bal, value: role === 'staff' ? null : r.value, refType: r.ref_type, refId: r.ref_id, refNo: docs.get(docKey(r.ref_type, r.ref_id)) ?? '', batchNo: r.batch_no ?? '', note: r.note, reversal: r.reverses_id !== null };
  });
  const filtered = out.filter((r) => (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to));
  return filtered.slice(-f.limit).reverse();
}

function batchState(expiry: string | null, today: string, soonDays: number): { days: number | null; state: BatchDto['state'] } {
  if (!expiry) return { days: null, state: 'none' };
  const days = daysBetween(today, expiry);
  return { days, state: days < 0 ? 'expired' : days <= soonDays ? 'soon' : 'ok' };
}

export function listBatches(ctx: Ctx, today: string, f: { productId?: number; includeEmpty: boolean; soonDays?: number }): BatchDto[] {
  const soon = f.soonDays ?? 30;
  return all<{ id: number; product_id: number; sku: string; name: string; batch_no: string; expiry_date: string | null; qty_remaining: number }>(
    ctx.db,
    `SELECT b.id, b.product_id, p.sku, p.name, b.batch_no, b.expiry_date, b.qty_remaining
       FROM stock_batches b JOIN products p ON p.id = b.product_id
      WHERE (? IS NULL OR b.product_id = ?) AND (? OR b.qty_remaining > 0)
      ORDER BY (b.expiry_date IS NULL), b.expiry_date, b.id`,
    f.productId ?? null, f.productId ?? null, f.includeEmpty ? 1 : 0
  ).map((b) => {
    const s = batchState(b.expiry_date, today, soon);
    return { id: b.id, productId: b.product_id, sku: b.sku, productName: b.name, batchNo: b.batch_no, expiry: b.expiry_date, qty: b.qty_remaining, daysToExpiry: s.days, state: s.state };
  });
}

export function stockAlerts(ctx: Ctx, today: string, soonDays: number): StockAlerts {
  const low = all<{ id: number; sku: string; name: string; stock_qty: number; reorder_level: number; base_unit: string }>(
    ctx.db, "SELECT id, sku, name, stock_qty, reorder_level, base_unit FROM products WHERE status = 'active' AND reorder_level > 0 AND stock_qty <= reorder_level ORDER BY (stock_qty * 1.0 / reorder_level), name COLLATE NOCASE"
  ).map((p) => ({ productId: p.id, sku: p.sku, name: p.name, stockQty: p.stock_qty, reorderLevel: p.reorder_level, baseUnit: p.base_unit }));
  const batches = listBatches(ctx, today, { includeEmpty: false, soonDays });
  return { low, expiring: batches.filter((b) => b.state === 'soon'), expired: batches.filter((b) => b.state === 'expired') };
}

export function listAdjustments(ctx: Ctx, role: Role, f: { from?: string; to?: string }): AdjustmentListItem[] {
  return all<{ id: number; doc_no: string; business_date: string; product_id: number; sku: string; name: string; kind: string; base_qty: number; value: number; reason: string; status: 'posted' | 'void' }>(
    ctx.db,
    `SELECT a.id, a.doc_no, a.business_date, a.product_id, p.sku, p.name, a.kind, a.base_qty, a.value, a.reason, a.status
       FROM stock_adjustments a JOIN products p ON p.id = a.product_id
      WHERE (? IS NULL OR a.business_date >= ?) AND (? IS NULL OR a.business_date <= ?) ORDER BY a.id DESC LIMIT 2000`,
    f.from ?? null, f.from ?? null, f.to ?? null, f.to ?? null
  ).map((a) => ({ id: a.id, docNo: a.doc_no, date: a.business_date, productId: a.product_id, sku: a.sku, productName: a.name, kind: a.kind, baseQty: a.base_qty, value: role === 'staff' ? null : a.value, reason: a.reason, status: a.status }));
}

export function assertManager(role: Role | undefined): void {
  if (role !== 'owner' && role !== 'manager') throw new PetraError('PERMISSION', 'manager role required');
}

