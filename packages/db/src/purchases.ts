import { PetraError, allocateDiscount, mulDiv, toBaseQty } from '@petra/core';
import { get, run } from './sql';
import { type Ctx, assertDateOpen, requireRow, tx } from './ctx';
import { nextDocNo } from './settings';
import { postCash, postLedger, resolveAccount } from './ledger';
import { loadProduct, stockIn, stockOut } from './stock';
import { resolvePack } from './sales';
import { reverseDocument } from './reverse';
import { audit } from './audit';

export interface PurchaseLineInput {
  productId: number;
  packId?: number | null;
  qty: number;
  /** Cost per ONE unit of the chosen pack level, in poisha. */
  unitCost: number;
  batchNo?: string;
  expiry?: string | null;
}

export interface PurchaseInput {
  supplierId?: number | null;
  supplierRef?: string;
  date: string;
  lines: PurchaseLineInput[];
  /** Fixed discount on the whole bill, in poisha. It lowers the stock cost. */
  discount?: number;
  paid: number;
  accountId?: number | null;
  note?: string;
}

export interface PurchaseResult { id: number; docNo: string; total: number; paid: number; due: number }

export function postPurchase(ctx: Ctx, input: PurchaseInput): PurchaseResult {
  return tx(ctx, () => {
    assertDateOpen(ctx, input.date);
    if (input.lines.length === 0) throw new PetraError('INVALID_INPUT', 'add at least one item', { field: 'lines' });
    const discount = input.discount ?? 0;
    if (!Number.isSafeInteger(discount) || discount < 0) throw new PetraError('INVALID_INPUT', 'discount must be a non-negative whole number of poisha', { field: 'discount' });
    if (!Number.isSafeInteger(input.paid) || input.paid < 0) throw new PetraError('INVALID_INPUT', 'paid must be a non-negative whole number of poisha', { field: 'paid' });
    if (input.supplierId) {
      const s = requireRow(get<{ status: string }>(ctx.db, 'SELECT status FROM suppliers WHERE id = ?', input.supplierId), 'supplier', input.supplierId);
      if (s.status !== 'active') throw new PetraError('INVALID_INPUT', 'supplier is archived', { field: 'supplier' });
    }

    const prepared = input.lines.map((l) => {
      const product = loadProduct(ctx, l.productId);
      if (product.status !== 'active') throw new PetraError('INVALID_INPUT', `${product.name} is archived`, { field: 'product', product: product.name });
      const pack = resolvePack(ctx, l.productId, l.packId);
      if (!Number.isSafeInteger(l.unitCost) || l.unitCost < 0) throw new PetraError('INVALID_INPUT', 'cost must be a non-negative whole number of poisha', { field: 'unitCost' });
      const baseQty = toBaseQty(l.qty, pack.factor);
      const amount = l.qty * l.unitCost;
      if (!Number.isSafeInteger(amount)) throw new PetraError('INVALID_INPUT', 'amount out of range');
      return { l, product, pack, baseQty, amount };
    });
    const subtotal = prepared.reduce((a, x) => a + x.amount, 0);
    if (discount > subtotal) throw new PetraError('INVALID_INPUT', 'discount is more than the bill', { field: 'discount' });
    const total = subtotal - discount;
    if (input.paid > total) throw new PetraError('OVER_PAYMENT', 'paid is more than the bill total', { total, paid: input.paid });
    const due = total - input.paid;
    if (!input.supplierId && due !== 0) throw new PetraError('INVALID_INPUT', 'a purchase without a supplier must be paid in full', { field: 'paid' });
    const alloc = allocateDiscount(discount, prepared.map((x) => x.amount));

    const accountId = input.paid > 0 ? resolveAccount(ctx, input.accountId) : null;
    const docNo = nextDocNo(ctx, 'PUR');
    const id = run(
      ctx.db,
      `INSERT INTO purchases(doc_no, supplier_id, supplier_ref, status, business_date, subtotal, discount, total, paid, due, account_id, note, user_id, created_at)
       VALUES(?,?,?,'posted',?,?,?,?,?,?,?,?,?,?)`,
      docNo, input.supplierId ?? null, input.supplierRef ?? '', input.date, subtotal, discount, total, input.paid, due, accountId, input.note ?? '', ctx.userId, ctx.now()
    ).id;

    prepared.forEach((x, i) => {
      const cost = x.amount - (alloc[i] as number);
      const itemId = run(
        ctx.db,
        `INSERT INTO purchase_items(purchase_id, line_no, product_id, pack_id, pack_name, factor, qty, base_qty, unit_cost, amount, alloc_discount, batch_no, expiry_date)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, i + 1, x.product.id, x.pack.id, x.pack.name, x.pack.factor, x.l.qty, x.baseQty, x.l.unitCost, x.amount, alloc[i] as number, x.l.batchNo ?? '', x.l.expiry ?? null
      ).id;
      const r = stockIn(ctx, { productId: x.product.id, baseQty: x.baseQty, value: cost, kind: 'purchase', date: input.date, refType: 'purchase', refId: id, batch: { batchNo: x.l.batchNo, expiry: x.l.expiry } });
      if (r.batchId) run(ctx.db, 'UPDATE purchase_items SET batch_id = ? WHERE id = ?', r.batchId, itemId);
    });

    if (input.supplierId) {
      if (total !== 0) postLedger(ctx, { partyKind: 'supplier', partyId: input.supplierId, kind: 'purchase', amount: total, refType: 'purchase', refId: id, date: input.date });
      if (input.paid > 0) postLedger(ctx, { partyKind: 'supplier', partyId: input.supplierId, kind: 'payment', amount: -input.paid, refType: 'purchase', refId: id, date: input.date, note: 'Paid at purchase' });
    }
    if (input.paid > 0 && accountId !== null) {
      postCash(ctx, { accountId, date: input.date, amount: -input.paid, source: 'purchase', refType: 'purchase', refId: id, partyKind: input.supplierId ? 'supplier' : null, partyId: input.supplierId ?? null });
    }
    audit(ctx, { action: 'purchase.create', entity: 'purchase', entityId: id, after: { docNo, total, paid: input.paid } });
    return { id, docNo, total, paid: input.paid, due };
  });
}

export function voidPurchase(ctx: Ctx, purchaseId: number, reason: string): void {
  if (!reason.trim()) throw new PetraError('REASON_REQUIRED', 'a reason is required to void a purchase');
  tx(ctx, () => {
    const p = requireRow(get<{ id: number; status: string; business_date: string }>(ctx.db, 'SELECT id, status, business_date FROM purchases WHERE id = ?', purchaseId), 'purchase', purchaseId);
    if (p.status === 'void') throw new PetraError('ALREADY_VOID', 'this purchase is already void');
    assertDateOpen(ctx, p.business_date);
    reverseDocument(ctx, 'purchase', purchaseId, p.business_date, `Void: ${reason}`);
    run(ctx.db, "UPDATE purchases SET status = 'void', void_reason = ?, voided_at = ?, voided_by = ? WHERE id = ?", reason, ctx.now(), ctx.userId, purchaseId);
    audit(ctx, { action: 'purchase.void', entity: 'purchase', entityId: purchaseId, reason });
  });
}

export interface PurchaseReturnInput {
  supplierId?: number | null;
  purchaseId?: number | null;
  date: string;
  lines: { productId: number; baseQty: number; /** Total credit the supplier gives for this line, in poisha. */ credit: number; batchId?: number | null }[];
  refundMode: 'due' | 'cash';
  accountId?: number | null;
  reason?: string;
}

/**
 * Purchase return: stock leaves at the CURRENT average cost; any difference to the credit the supplier
 * gives is booked to COGS (section 5.4) via `variance = cost_value - credit`.
 */
export function postPurchaseReturn(ctx: Ctx, input: PurchaseReturnInput): { id: number; docNo: string; credit: number; costValue: number; variance: number } {
  return tx(ctx, () => {
    assertDateOpen(ctx, input.date);
    if (input.lines.length === 0) throw new PetraError('INVALID_INPUT', 'choose at least one item', { field: 'lines' });
    if (input.refundMode === 'due' && !input.supplierId) throw new PetraError('INVALID_INPUT', 'a return without a supplier must be refunded in cash', { field: 'refundMode' });
    for (const l of input.lines) {
      if (!Number.isSafeInteger(l.credit) || l.credit < 0) throw new PetraError('INVALID_INPUT', 'credit must be a non-negative whole number of poisha', { field: 'credit' });
    }
    const docNo = nextDocNo(ctx, 'PRN');
    const credit = input.lines.reduce((a, l) => a + l.credit, 0);
    const accountId = input.refundMode === 'cash' && credit > 0 ? resolveAccount(ctx, input.accountId) : null;
    const id = run(
      ctx.db,
      `INSERT INTO purchase_returns(doc_no, purchase_id, supplier_id, business_date, refund_mode, account_id, credit, cost_value, variance, status, reason, user_id, created_at)
       VALUES(?,?,?,?,?,?,?,0,0,'posted',?,?,?)`,
      docNo, input.purchaseId ?? null, input.supplierId ?? null, input.date, input.refundMode, accountId, credit, input.reason ?? '', ctx.userId, ctx.now()
    ).id;
    let costValue = 0;
    for (const l of input.lines) {
      const out = stockOut(ctx, { productId: l.productId, baseQty: l.baseQty, kind: 'purchase_return', date: input.date, refType: 'purchase_return', refId: id, preferBatchId: l.batchId });
      costValue += out.cogs;
      run(ctx.db, 'INSERT INTO purchase_return_items(return_id, product_id, batch_id, base_qty, credit, cost_value) VALUES(?,?,?,?,?,?)', id, l.productId, l.batchId ?? null, l.baseQty, l.credit, out.cogs);
    }
    const variance = costValue - credit;
    run(ctx.db, 'UPDATE purchase_returns SET cost_value = ?, variance = ? WHERE id = ?', costValue, variance, id);
    if (credit > 0) {
      if (input.supplierId) {
        postLedger(ctx, { partyKind: 'supplier', partyId: input.supplierId, kind: 'return', amount: -credit, refType: 'purchase_return', refId: id, date: input.date, note: docNo });
        if (input.refundMode === 'cash') postLedger(ctx, { partyKind: 'supplier', partyId: input.supplierId, kind: 'payment', amount: credit, refType: 'purchase_return', refId: id, date: input.date, note: 'Cash refund received' });
      }
      if (input.refundMode === 'cash' && accountId !== null) {
        postCash(ctx, { accountId, date: input.date, amount: credit, source: 'refund', refType: 'purchase_return', refId: id, partyKind: input.supplierId ? 'supplier' : null, partyId: input.supplierId ?? null });
      }
    }
    audit(ctx, { action: 'purchase_return.create', entity: 'purchase_return', entityId: id, after: { docNo, credit, costValue }, reason: input.reason });
    return { id, docNo, credit, costValue, variance };
  });
}

export function voidPurchaseReturn(ctx: Ctx, returnId: number, reason: string): void {
  if (!reason.trim()) throw new PetraError('REASON_REQUIRED', 'a reason is required to void a return');
  tx(ctx, () => {
    const r = requireRow(get<{ id: number; status: string; business_date: string }>(ctx.db, 'SELECT id, status, business_date FROM purchase_returns WHERE id = ?', returnId), 'return', returnId);
    if (r.status === 'void') throw new PetraError('ALREADY_VOID', 'this return is already void');
    assertDateOpen(ctx, r.business_date);
    reverseDocument(ctx, 'purchase_return', returnId, r.business_date, `Void: ${reason}`);
    run(ctx.db, "UPDATE purchase_returns SET status = 'void', void_reason = ? WHERE id = ?", reason, returnId);
    audit(ctx, { action: 'purchase_return.void', entity: 'purchase_return', entityId: returnId, reason });
  });
}

export { mulDiv };
